use std::sync::Arc;
use std::time::Instant;

use axum::Json;
use axum::extract::State;
use tokio::sync::RwLock;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

use super::types::*;

const WIKI_BASE: &str = "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday";
const CACHE_TTL_SECS: u64 = 6 * 60 * 60; // 6 hours

#[derive(Clone)]
pub struct OnThisDayState {
    pub pool: sqlx::SqlitePool,
    pub client: reqwest::Client,
    pub cache: Arc<OnThisDayCache>,
}

pub struct OnThisDayCache {
    data: RwLock<Option<(String, OnThisDayResponse, Instant)>>,
}

impl OnThisDayCache {
    pub fn new() -> Self {
        Self {
            data: RwLock::new(None),
        }
    }

    async fn get(&self, key: &str) -> Option<OnThisDayResponse> {
        let guard = self.data.read().await;
        if let Some((cached_key, response, created_at)) = guard.as_ref() {
            if cached_key == key && created_at.elapsed().as_secs() < CACHE_TTL_SECS {
                return Some(response.clone());
            }
        }
        None
    }

    async fn set(&self, key: String, response: OnThisDayResponse) {
        let mut guard = self.data.write().await;
        *guard = Some((key, response, Instant::now()));
    }
}

async fn fetch_selected(client: &reqwest::Client, month: u32, day: u32) -> Vec<WikiEvent> {
    let url = format!("{}/selected/{:02}/{:02}", WIKI_BASE, month, day);
    let resp = match client.get(&url).send().await {
        Ok(r) if r.status().is_success() => r,
        Ok(r) => {
            tracing::warn!("Wikipedia selected returned status {}", r.status());
            return vec![];
        }
        Err(e) => {
            tracing::warn!("Wikipedia selected fetch failed: {}", e);
            return vec![];
        }
    };
    match resp.json::<WikiSelectedResponse>().await {
        Ok(r) => {
            let events = r.selected.unwrap_or_default();
            tracing::info!("Fetched {} selected events from Wikipedia", events.len());
            events
        }
        Err(e) => {
            tracing::warn!("Wikipedia selected parse failed: {}", e);
            vec![]
        }
    }
}

async fn fetch_births(client: &reqwest::Client, month: u32, day: u32) -> Vec<WikiBirth> {
    let url = format!("{}/births/{:02}/{:02}", WIKI_BASE, month, day);
    let resp = match client.get(&url).send().await {
        Ok(r) if r.status().is_success() => r,
        Ok(r) => {
            tracing::warn!("Wikipedia births returned status {}", r.status());
            return vec![];
        }
        Err(e) => {
            tracing::warn!("Wikipedia births fetch failed: {}", e);
            return vec![];
        }
    };
    match resp.json::<WikiBirthsResponse>().await {
        Ok(r) => {
            let births = r.births.unwrap_or_default();
            tracing::info!("Fetched {} births from Wikipedia", births.len());
            births
        }
        Err(e) => {
            tracing::warn!("Wikipedia births parse failed: {}", e);
            vec![]
        }
    }
}

async fn fetch_holidays(client: &reqwest::Client, month: u32, day: u32) -> Vec<WikiHoliday> {
    let url = format!("{}/holidays/{:02}/{:02}", WIKI_BASE, month, day);
    let resp = match client.get(&url).send().await {
        Ok(r) if r.status().is_success() => r,
        _ => return vec![],
    };
    resp.json::<WikiHolidaysResponse>()
        .await
        .ok()
        .and_then(|r| r.holidays)
        .unwrap_or_default()
}

async fn is_family_friendly(
    client: &reqwest::Client,
    ollama_url: &str,
    ollama_token: Option<&str>,
    model: &str,
    text: &str,
) -> Result<bool, AppError> {
    let url = format!("{}/api/generate", ollama_url.trim_end_matches('/'));
    tracing::debug!("Ollama filter request: url={}, model={}", url, model);

    let prompt = format!(
        "Is this historical event appropriate for a family kitchen dashboard seen by young \
         children? Only say yes if the content is free of violence, crime, disasters, and death. \
         Answer only 'yes' or 'no'.\n\nEvent: {}",
        text
    );

    let mut req = client.post(&url).json(&serde_json::json!({
        "model": model,
        "prompt": prompt,
        "stream": false,
    }));

    if let Some(token) = ollama_token {
        req = req.bearer_auth(token);
    }

    let resp = req
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Ollama request to {} failed: {}", url, e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "Ollama returned {} for model '{}': {}",
            status, model, body
        )));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Ollama parse failed: {}", e)))?;

    let answer = data["response"]
        .as_str()
        .unwrap_or("no")
        .trim()
        .to_lowercase();

    let is_ok = answer.starts_with("yes");
    tracing::info!(
        "Ollama filter: '{}' → {} (answer: '{}')",
        &text[..text.len().min(60)],
        if is_ok { "PASS" } else { "FILTERED" },
        answer
    );

    Ok(is_ok)
}

fn pick_births(births: Vec<WikiBirth>) -> Vec<OnThisDayBirth> {
    births
        .into_iter()
        .filter_map(|b| {
            let year = b.year?;
            let name = b.text.split(',').next()?.trim().to_string();
            let role = b
                .pages
                .as_ref()
                .and_then(|pages| pages.first())
                .and_then(|p| p.description.clone())
                .unwrap_or_default();
            if role.is_empty() {
                return None;
            }
            Some(OnThisDayBirth { year, name, role })
        })
        .take(3)
        .collect()
}

pub async fn get_events(
    State(state): State<OnThisDayState>,
) -> Result<Json<OnThisDayResponse>, AppError> {
    let now = chrono::Local::now();
    let month = now.format("%m").to_string().parse::<u32>().unwrap();
    let day = now.format("%d").to_string().parse::<u32>().unwrap();
    let cache_key = format!("{:02}_{:02}", month, day);

    // Check cache
    if let Some(cached) = state.cache.get(&cache_key).await {
        return Ok(Json(cached));
    }

    // Fetch all three in parallel
    let (selected, births, holidays) = tokio::join!(
        fetch_selected(&state.client, month, day),
        fetch_births(&state.client, month, day),
        fetch_holidays(&state.client, month, day),
    );

    let ollama_config = IntegrationConfig::new(&state.pool, "ollama");
    let ollama_url = ollama_config
        .get_or("url", "http://localhost:11434")
        .await?;
    let ollama_token = ollama_config.get("token").await.ok();

    let integration_config = IntegrationConfig::new(&state.pool, "on_this_day");
    let model = integration_config
        .get_or("ollama_model", "llama3.2:3b")
        .await?;

    tracing::info!(
        "On This Day: filtering {} events via Ollama at {} with model '{}'",
        selected.len(),
        ollama_url,
        model
    );

    // Filter events through Ollama for family-friendliness
    // If Ollama is unreachable, include all events unfiltered
    let mut events = Vec::new();
    let mut ollama_available = true;
    for ev in &selected {
        match is_family_friendly(
            &state.client,
            &ollama_url,
            ollama_token.as_deref(),
            &model,
            &ev.text,
        )
        .await
        {
            Ok(true) => events.push(OnThisDayEvent {
                year: ev.year,
                text: ev.text.clone(),
            }),
            Ok(false) => {}
            Err(e) => {
                tracing::warn!("Ollama filter unavailable, including all events: {}", e);
                ollama_available = false;
                break;
            }
        }
    }

    if ollama_available {
        tracing::info!(
            "Ollama filtering complete: {}/{} events passed",
            events.len(),
            selected.len()
        );
    }

    // Fallback: if Ollama is down, include all events unfiltered
    if !ollama_available {
        tracing::warn!(
            "Ollama unavailable, returning all {} events unfiltered",
            selected.len()
        );
        events = selected
            .iter()
            .map(|ev| OnThisDayEvent {
                year: ev.year,
                text: ev.text.clone(),
            })
            .collect();
    }

    // Add holidays as events (no filtering needed)
    for holiday in holidays {
        events.push(OnThisDayEvent {
            year: None,
            text: holiday.text,
        });
    }

    let picked_births = pick_births(births);

    let response = OnThisDayResponse {
        events,
        births: picked_births,
    };

    // Only cache if we have content
    if !response.events.is_empty() || !response.births.is_empty() {
        state.cache.set(cache_key, response.clone()).await;
    }

    Ok(Json(response))
}

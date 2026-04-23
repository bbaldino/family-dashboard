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

async fn fetch_events(client: &reqwest::Client, month: u32, day: u32) -> Vec<WikiEvent> {
    let url = format!("{}/events/{:02}/{:02}", WIKI_BASE, month, day);
    let resp = match client.get(&url).send().await {
        Ok(r) if r.status().is_success() => r,
        Ok(r) => {
            tracing::warn!("Wikipedia events returned status {}", r.status());
            return vec![];
        }
        Err(e) => {
            tracing::warn!("Wikipedia events fetch failed: {}", e);
            return vec![];
        }
    };
    match resp.json::<WikiEventsResponse>().await {
        Ok(r) => {
            let events = r.events.unwrap_or_default();
            tracing::info!("Fetched {} general events from Wikipedia", events.len());
            events
        }
        Err(e) => {
            tracing::warn!("Wikipedia events parse failed: {}", e);
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

/// Extract thumbnail URL from a WikiEvent's pages
fn event_image_url(event: &WikiEvent) -> Option<String> {
    event
        .pages
        .as_ref()
        .and_then(|pages| pages.first())
        .and_then(|p| p.thumbnail.as_ref())
        .and_then(|t| t.source.clone())
}

/// Clean up Wikipedia event text by removing picture references
fn clean_event_text(text: &str) -> String {
    text.replace(" (pictured)", "")
        .replace("(pictured) ", "")
        .replace(" (Pictured)", "")
        .replace("(Pictured) ", "")
        .replace(" (replica pictured)", "")
        .replace("(replica pictured) ", "")
        .replace(" (shown)", "")
        .replace("(shown) ", "")
}

/// Pre-filter events to remove obviously inappropriate ones before sending to Ollama.
/// This reduces the chance of the model picking something bad from a long list.
fn pre_filter_events(events: &[WikiEvent]) -> Vec<&WikiEvent> {
    const BAD_KEYWORDS: &[&str] = &[
        "kill",
        "killed",
        "kills",
        "murder",
        "murdered",
        "massacre",
        "shooting",
        "shot dead",
        "assassin",
        "death",
        "dead",
        "died",
        "dies",
        "fatal",
        "bomb",
        "bombed",
        "bombing",
        "attack",
        "attacked",
        "terrorist",
        "war ",
        "warfare",
        "battle of",
        "invasion",
        "invaded",
        "earthquake",
        "tsunami",
        "hurricane",
        "flood",
        "famine",
        "crash",
        "crashed",
        "derail",
        "sank",
        "sinking",
        "capsiz",
        "riot",
        "riots",
        "protest",
        "coup",
        "rebellion",
        "revolt",
        "genocide",
        "ethnic cleansing",
        "concentration camp",
        "collapse",
        "collapsed",
        "explosion",
        "exploded",
        "suicide",
        "execution",
        "executed",
        "hanged",
        "kidnap",
        "hostage",
        "hijack",
        "immigration",
        "deportation",
        "controversial",
        "scandal",
    ];

    events
        .iter()
        .filter(|e| {
            let lower = e.text.to_lowercase();
            !BAD_KEYWORDS.iter().any(|kw| lower.contains(kw))
        })
        .collect()
}

/// Use Ollama to curate the best events from the full list.
/// Instead of filtering one-by-one, send all events in one prompt and ask
/// Ollama to pick the most interesting, family-friendly ones.
async fn curate_events(
    client: &reqwest::Client,
    ollama_url: &str,
    ollama_token: Option<&str>,
    model: &str,
    events: &[WikiEvent],
) -> Result<Vec<OnThisDayEvent>, AppError> {
    // Build a numbered list of events for the prompt
    let event_list: String = events
        .iter()
        .enumerate()
        .map(|(i, e)| {
            format!(
                "{}. [{}] {}",
                i + 1,
                e.year.map(|y| y.to_string()).unwrap_or_default(),
                e.text
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    let prompt = format!(
        "You are curating content for a family kitchen dashboard seen by young children. \
         From the following historical events that happened on this day, pick the 5 most interesting and fun ones. \
         Strongly prefer: pop culture, science, technology, space, sports, music, entertainment, inventions, and achievements. \
         Strictly avoid: violence, war, crime, disasters, death, controversial politics, immigration, protests, and anything divisive or upsetting. \
         Only pick events that would make someone smile or say 'that's cool!' \
         Respond with ONLY the numbers of your picks, separated by commas. Nothing else.\n\n{}",
        event_list
    );

    let url = format!("{}/api/generate", ollama_url.trim_end_matches('/'));
    tracing::info!("Curating {} events via Ollama", events.len());

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
        .map_err(|e| AppError::Internal(format!("Ollama request failed: {}", e)))?;

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

    let answer = data["response"].as_str().unwrap_or("").trim().to_string();
    tracing::info!("Ollama curated picks: '{}'", answer);

    // Parse the comma-separated numbers
    let picked: Vec<OnThisDayEvent> = answer
        .split(|c: char| c == ',' || c == ' ' || c == '.')
        .filter_map(|s| s.trim().parse::<usize>().ok())
        .filter_map(|i| {
            let idx = i.checked_sub(1)?; // 1-based to 0-based
            let ev = events.get(idx)?;
            Some(OnThisDayEvent {
                year: ev.year,
                text: clean_event_text(&ev.text),
                image_url: event_image_url(ev),
            })
        })
        .collect();

    Ok(picked)
}

const ENTERTAINMENT_KEYWORDS: &[&str] = &[
    "actor",
    "actress",
    "singer",
    "musician",
    "comedian",
    "director",
    "filmmaker",
    "rapper",
    "entertainer",
    "model",
    "television",
    "film",
    "songwriter",
    "producer",
    "dancer",
    "voice actor",
    "screenwriter",
    "animator",
    "composer",
];

fn is_entertainment_figure(description: &str) -> bool {
    let lower = description.to_lowercase();
    ENTERTAINMENT_KEYWORDS.iter().any(|kw| lower.contains(kw))
}

async fn pick_births_with_tmdb(
    client: &reqwest::Client,
    births: &[WikiBirth],
    tmdb_api_key: Option<&str>,
) -> Vec<OnThisDayBirth> {
    // Filter for entertainment figures first
    let candidates: Vec<_> = births
        .iter()
        .filter_map(|b| {
            let year = b.year?;
            let name = b.text.split(',').next()?.trim().to_string();
            let role = b
                .pages
                .as_ref()
                .and_then(|pages| pages.first())
                .and_then(|p| p.description.clone())
                .unwrap_or_default();
            if role.is_empty() || !is_entertainment_figure(&role) {
                return None;
            }
            Some((year, name, role))
        })
        .take(15) // Check top 15 candidates
        .collect();

    if candidates.is_empty() {
        return vec![];
    }

    let Some(api_key) = tmdb_api_key else {
        // No TMDB key — fall back to Wikipedia data only
        return candidates
            .into_iter()
            .take(3)
            .map(|(year, name, role)| OnThisDayBirth {
                year,
                name,
                role,
                known_for: vec![],
                photo_url: None,
            })
            .collect();
    };

    // Enrich with TMDB data
    let mut results: Vec<(f64, OnThisDayBirth)> = vec![];

    for (year, name, role) in &candidates {
        let search_url = format!(
            "https://api.themoviedb.org/3/search/person?api_key={}&query={}",
            api_key,
            urlencoding::encode(name)
        );

        let resp = match client.get(&search_url).send().await {
            Ok(r) if r.status().is_success() => r,
            _ => continue,
        };

        let data: serde_json::Value = match resp.json().await {
            Ok(d) => d,
            Err(_) => continue,
        };

        let tmdb_results = data["results"].as_array();
        let Some(top) = tmdb_results.and_then(|r| r.first()) else {
            continue;
        };

        let popularity = top["popularity"].as_f64().unwrap_or(0.0);
        let photo_path = top["profile_path"]
            .as_str()
            .map(|p| format!("https://image.tmdb.org/t/p/w185{}", p));
        let known_for: Vec<String> = top["known_for"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|k| {
                        k["title"]
                            .as_str()
                            .or_else(|| k["name"].as_str())
                            .map(|s| s.to_string())
                    })
                    .take(2)
                    .collect()
            })
            .unwrap_or_default();

        results.push((
            popularity,
            OnThisDayBirth {
                year: *year,
                name: name.clone(),
                role: role.clone(),
                known_for,
                photo_url: photo_path,
            },
        ));

        if results.len() >= 10 {
            break;
        }
    }

    // Sort by TMDB popularity descending, take top 3
    results.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    results.into_iter().take(3).map(|(_, b)| b).collect()
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

    // Fetch all four in parallel
    let (selected, general_events, births, holidays) = tokio::join!(
        fetch_selected(&state.client, month, day),
        fetch_events(&state.client, month, day),
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

    // Combine selected + general events for a bigger pool to curate from
    let mut all_events = selected;
    // Deduplicate by text (selected and events overlap)
    let existing_texts: std::collections::HashSet<String> =
        all_events.iter().map(|e| e.text.clone()).collect();
    for ev in general_events {
        if !existing_texts.contains(&ev.text) {
            all_events.push(ev);
        }
    }

    // Pre-filter to remove obviously inappropriate events before sending to Ollama
    let filtered: Vec<WikiEvent> = pre_filter_events(&all_events)
        .into_iter()
        .cloned()
        .collect();
    tracing::info!(
        "Pre-filtered {}/{} events (removed {} inappropriate)",
        filtered.len(),
        all_events.len(),
        all_events.len() - filtered.len()
    );

    // Use Ollama to curate the most interesting events
    let events = match curate_events(
        &state.client,
        &ollama_url,
        ollama_token.as_deref(),
        &model,
        &filtered,
    )
    .await
    {
        Ok(curated) => {
            tracing::info!("Ollama curated {}/{} events", curated.len(), filtered.len());
            let mut events = curated;
            // Add holidays (always appropriate, no curation needed)
            for holiday in holidays {
                events.push(OnThisDayEvent {
                    year: None,
                    text: holiday.text,
                    image_url: None,
                });
            }
            events
        }
        Err(e) => {
            tracing::warn!(
                "Ollama curation failed, returning pre-filtered events: {}",
                e
            );
            let mut events: Vec<OnThisDayEvent> = filtered
                .iter()
                .map(|ev| OnThisDayEvent {
                    year: ev.year,
                    text: clean_event_text(&ev.text),
                    image_url: event_image_url(ev),
                })
                .collect();
            for holiday in holidays {
                events.push(OnThisDayEvent {
                    year: None,
                    text: holiday.text,
                    image_url: None,
                });
            }
            events
        }
    };

    let tmdb_config = IntegrationConfig::new(&state.pool, "tmdb");
    let tmdb_api_key = tmdb_config.get("api_key").await.ok();
    let picked_births =
        pick_births_with_tmdb(&state.client, &births, tmdb_api_key.as_deref()).await;

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

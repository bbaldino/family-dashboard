use std::sync::Arc;
use std::time::Instant;

use axum::Json;
use axum::extract::State;
use tokio::sync::RwLock;

use sqlx::SqlitePool;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

use super::INTEGRATION_ID;
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

impl Default for OnThisDayCache {
    fn default() -> Self {
        Self::new()
    }
}

impl OnThisDayCache {
    pub fn new() -> Self {
        Self {
            data: RwLock::new(None),
        }
    }

    async fn get(&self, key: &str) -> Option<OnThisDayResponse> {
        let guard = self.data.read().await;
        if let Some((cached_key, response, created_at)) = guard.as_ref()
            && cached_key == key
            && created_at.elapsed().as_secs() < CACHE_TTL_SECS
        {
            return Some(response.clone());
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

/// Use the configured LLM to curate the best events from the full list.
/// Instead of filtering one-by-one, send all events in one prompt and ask
/// the model to pick the most interesting, family-friendly ones.
async fn curate_events(
    pool: &SqlitePool,
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

    tracing::info!("Curating {} events via LLM", events.len());
    let answer = crate::llm::generate(pool, model, &prompt).await?;
    tracing::info!("LLM curated picks: '{}'", answer);

    // Parse the comma-separated numbers
    let picked: Vec<OnThisDayEvent> = answer
        .split([',', ' ', '.'])
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

    let (selected, general_events) = tokio::join!(
        fetch_selected(&state.client, month, day),
        fetch_events(&state.client, month, day),
    );

    let integration_config = IntegrationConfig::new(&state.pool, INTEGRATION_ID);
    let model = integration_config.get_or("model", "llama3.2:3b").await?;

    tracing::info!(
        "On This Day: filtering {} events via LLM with model '{}'",
        selected.len(),
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

    // Use the LLM to curate the most interesting events
    let events = match curate_events(&state.pool, &model, &filtered).await {
        Ok(curated) => {
            tracing::info!("LLM curated {}/{} events", curated.len(), filtered.len());
            let events = curated;
            // Add non-religious holidays
            events
        }
        Err(e) => {
            tracing::warn!(
                "Ollama curation failed, returning pre-filtered events: {}",
                e
            );
            let events: Vec<OnThisDayEvent> = filtered
                .iter()
                .map(|ev| OnThisDayEvent {
                    year: ev.year,
                    text: clean_event_text(&ev.text),
                    image_url: event_image_url(ev),
                })
                .collect();
            events
        }
    };

    let response = OnThisDayResponse { events };

    if !response.events.is_empty() {
        state.cache.set(cache_key, response.clone()).await;
    }

    Ok(Json(response))
}

use std::sync::Arc;
use std::time::Instant;

use axum::Json;
use axum::extract::State;
use regex::Regex;
use serde::Serialize;
use tokio::sync::RwLock;

use crate::error::AppError;

const MW_URL: &str = "https://www.merriam-webster.com/word-of-the-day";
const CACHE_TTL_SECS: u64 = 24 * 60 * 60;

#[derive(Clone)]
pub struct WordState {
    pub client: reqwest::Client,
    pub cache: Arc<WordCache>,
}

pub struct WordCache {
    data: RwLock<Option<(String, WordResponse, Instant)>>,
}

impl WordCache {
    pub fn new() -> Self {
        Self {
            data: RwLock::new(None),
        }
    }

    async fn get(&self, key: &str) -> Option<WordResponse> {
        let guard = self.data.read().await;
        if let Some((cached_key, response, created_at)) = guard.as_ref() {
            if cached_key == key && created_at.elapsed().as_secs() < CACHE_TTL_SECS {
                return Some(response.clone());
            }
        }
        None
    }

    async fn set(&self, key: String, response: WordResponse) {
        let mut guard = self.data.write().await;
        *guard = Some((key, response, Instant::now()));
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WordResponse {
    pub word: String,
    pub part_of_speech: Option<String>,
    pub definition: String,
    pub example: Option<String>,
}

pub async fn get_today(State(state): State<WordState>) -> Result<Json<WordResponse>, AppError> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    if let Some(cached) = state.cache.get(&today).await {
        return Ok(Json(cached));
    }

    tracing::info!("Fetching word of the day from Merriam-Webster");

    let resp = state
        .client
        .get(MW_URL)
        .header("User-Agent", "DashboardApp/1.0 (family kitchen dashboard)")
        .send()
        .await
        .map_err(|e| {
            tracing::warn!("Merriam-Webster request failed: {}", e);
            AppError::Internal(format!("Merriam-Webster request failed: {}", e))
        })?;

    if !resp.status().is_success() {
        let status = resp.status();
        tracing::warn!("Merriam-Webster returned {}", status);
        return Err(AppError::Internal(format!(
            "Merriam-Webster returned {}",
            status
        )));
    }

    let html = resp.text().await.map_err(|e| {
        tracing::warn!("Merriam-Webster read failed: {}", e);
        AppError::Internal(format!("Merriam-Webster read failed: {}", e))
    })?;

    // Parse word
    let word_re = Regex::new(r#"<h2 class="word-header-txt">([^<]+)</h2>"#).unwrap();
    let word = word_re
        .captures(&html)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().trim().to_string())
        .ok_or_else(|| {
            tracing::warn!("Could not parse word from Merriam-Webster HTML");
            AppError::Internal("Could not parse word from Merriam-Webster".to_string())
        })?;

    // Parse part of speech
    let pos_re = Regex::new(r#"<span class="main-attr">([^<]+)</span>"#).unwrap();
    let part_of_speech = pos_re
        .captures(&html)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().trim().to_string());

    // Parse definition and example from wod-definition-container
    // The container has: <h2>What It Means</h2> <p>definition...</p> <p>// example...</p>
    let tag_re = Regex::new(r"<[^>]+>").unwrap();
    let container_re =
        Regex::new(r#"(?s)wod-definition-container">\s*<h2>[^<]*</h2>\s*<p>(.*?)</p>"#).unwrap();
    let definition = container_re
        .captures(&html)
        .and_then(|c| c.get(1))
        .map(|m| tag_re.replace_all(m.as_str(), "").trim().to_string())
        .unwrap_or_default();

    // Example is the second <p> after the definition, starts with "// "
    let example_re = Regex::new(
        r#"(?s)wod-definition-container">\s*<h2>[^<]*</h2>\s*<p>.*?</p>\s*<p>(.*?)</p>"#,
    )
    .unwrap();
    let example = example_re.captures(&html).and_then(|c| c.get(1)).map(|m| {
        let text = tag_re.replace_all(m.as_str(), "").trim().to_string();
        // Remove leading "// " prefix
        text.strip_prefix("// ").unwrap_or(&text).to_string()
    });

    tracing::info!(
        "Word of the day: '{}' ({})",
        word,
        part_of_speech.as_deref().unwrap_or("?")
    );

    let response = WordResponse {
        word,
        part_of_speech,
        definition,
        example,
    };

    state.cache.set(today, response.clone()).await;

    Ok(Json(response))
}

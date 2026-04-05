use std::sync::Arc;
use std::time::Instant;

use axum::Json;
use axum::extract::State;
use serde::Serialize;
use tokio::sync::RwLock;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

use super::INTEGRATION_ID;

const WORDNIK_URL: &str = "https://api.wordnik.com/v4/words.json/wordOfTheDay";
const CACHE_TTL_SECS: u64 = 24 * 60 * 60;

#[derive(Clone)]
pub struct WordState {
    pub pool: sqlx::SqlitePool,
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

    let api_key = IntegrationConfig::new(&state.pool, INTEGRATION_ID)
        .get("api_key")
        .await?;

    let resp = state
        .client
        .get(WORDNIK_URL)
        .query(&[("api_key", &api_key)])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Wordnik request failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "Wordnik returned {}: {}",
            status, body
        )));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Wordnik parse failed: {}", e)))?;

    let word = data["word"]
        .as_str()
        .ok_or_else(|| AppError::Internal("Wordnik response missing 'word'".to_string()))?
        .to_string();

    let definition = data["definitions"][0]["text"]
        .as_str()
        .ok_or_else(|| AppError::Internal("Wordnik response missing definition".to_string()))?
        .to_string();

    let part_of_speech = data["definitions"][0]["partOfSpeech"]
        .as_str()
        .map(|s| s.to_string());

    let example = data["examples"][0]["text"].as_str().map(|s| s.to_string());

    let response = WordResponse {
        word,
        part_of_speech,
        definition,
        example,
    };

    state.cache.set(today, response.clone()).await;

    Ok(Json(response))
}

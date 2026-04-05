use std::sync::Arc;
use std::time::Instant;

use axum::Json;
use axum::extract::State;
use serde::Serialize;
use tokio::sync::RwLock;

use crate::error::AppError;

#[derive(Clone)]
pub struct JokesState {
    pub client: reqwest::Client,
    pub cache: Arc<JokesCache>,
}

pub struct JokesCache {
    entry: RwLock<Option<CacheEntry>>,
}

struct CacheEntry {
    response: JokeResponse,
    fetched_at: Instant,
}

impl JokesCache {
    pub fn new() -> Self {
        Self {
            entry: RwLock::new(None),
        }
    }

    pub async fn get(&self) -> Option<JokeResponse> {
        let entry = self.entry.read().await;
        let entry = entry.as_ref()?;
        if entry.fetched_at.elapsed().as_secs() > 24 * 3600 {
            return None;
        }
        Some(entry.response.clone())
    }

    pub async fn set(&self, response: JokeResponse) {
        let mut entry = self.entry.write().await;
        *entry = Some(CacheEntry {
            response,
            fetched_at: Instant::now(),
        });
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JokeResponse {
    #[serde(rename = "type")]
    pub joke_type: String,
    pub setup: Option<String>,
    pub delivery: Option<String>,
    pub joke: Option<String>,
}

pub async fn get_today(State(state): State<JokesState>) -> Result<Json<JokeResponse>, AppError> {
    if let Some(cached) = state.cache.get().await {
        return Ok(Json(cached));
    }

    let resp = state
        .client
        .get("https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,religious,political,racist,sexist,explicit&type=twopart,single")
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("JokeAPI request failed: {}", e)))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!("JokeAPI error: {}", body)));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("JokeAPI parse failed: {}", e)))?;

    let joke_type = data["type"].as_str().unwrap_or("single").to_string();

    let response = if joke_type == "twopart" {
        JokeResponse {
            joke_type,
            setup: data["setup"].as_str().map(|s| s.to_string()),
            delivery: data["delivery"].as_str().map(|s| s.to_string()),
            joke: None,
        }
    } else {
        JokeResponse {
            joke_type,
            setup: None,
            delivery: None,
            joke: data["joke"].as_str().map(|s| s.to_string()),
        }
    };

    state.cache.set(response.clone()).await;

    Ok(Json(response))
}

use std::sync::Arc;
use std::time::Instant;

use axum::Json;
use axum::extract::State;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

use crate::error::AppError;

const ZENQUOTES_URL: &str = "https://zenquotes.io/api/today";
const CACHE_TTL_SECS: u64 = 24 * 60 * 60; // 24 hours

#[derive(Clone)]
pub struct QuoteState {
    pub client: reqwest::Client,
    pub cache: Arc<QuoteCache>,
}

pub struct QuoteCache {
    data: RwLock<Option<(QuoteResponse, Instant)>>,
}

impl QuoteCache {
    pub fn new() -> Self {
        Self {
            data: RwLock::new(None),
        }
    }

    async fn get(&self) -> Option<QuoteResponse> {
        let guard = self.data.read().await;
        if let Some((response, created_at)) = guard.as_ref() {
            if created_at.elapsed().as_secs() < CACHE_TTL_SECS {
                return Some(response.clone());
            }
        }
        None
    }

    async fn set(&self, response: QuoteResponse) {
        let mut guard = self.data.write().await;
        *guard = Some((response, Instant::now()));
    }
}

#[derive(Debug, Deserialize)]
struct ZenQuote {
    q: String,
    a: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct QuoteResponse {
    pub quote: String,
    pub author: String,
}

pub async fn get_today(State(state): State<QuoteState>) -> Result<Json<QuoteResponse>, AppError> {
    if let Some(cached) = state.cache.get().await {
        return Ok(Json(cached));
    }

    tracing::info!("Fetching daily quote from ZenQuotes");

    let resp = state.client.get(ZENQUOTES_URL).send().await.map_err(|e| {
        tracing::warn!("ZenQuotes request failed: {}", e);
        AppError::Internal(format!("ZenQuotes request failed: {}", e))
    })?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        tracing::warn!("ZenQuotes returned {}: {}", status, body);
        return Err(AppError::Internal(format!(
            "ZenQuotes returned {}: {}",
            status, body
        )));
    }

    let quotes: Vec<ZenQuote> = resp.json().await.map_err(|e| {
        tracing::warn!("ZenQuotes parse failed: {}", e);
        AppError::Internal(format!("ZenQuotes parse failed: {}", e))
    })?;

    let zen = quotes.into_iter().next().ok_or_else(|| {
        tracing::warn!("ZenQuotes returned empty response");
        AppError::Internal("ZenQuotes returned empty response".to_string())
    })?;

    tracing::info!(
        "Daily quote: '{}' — {}",
        &zen.q[..zen.q.len().min(50)],
        zen.a
    );

    let response = QuoteResponse {
        quote: zen.q,
        author: zen.a,
    };

    state.cache.set(response.clone()).await;

    Ok(Json(response))
}

//! The LLM capability: model listing and single-prompt generation against a
//! single openai-compatible backend, configured by `llm.url`.
//!
//! Mirrors `platform::fetch`'s logging discipline (see that module's docs)
//! for the same reason: `llm.url` is an operator-configured endpoint, and a
//! prompt or its response can carry anything the caller puts in it. Neither
//! is ever logged — errors carry the model name and upstream status only,
//! never response content.

use std::sync::LazyLock;
use std::time::Duration;

use axum::{
    Json, Router,
    extract::State,
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

/// Shared client for both requests this module makes. `platform::fetch`'s
/// 8s timeout is wrong here: that is a budget for a JSON API responding
/// immediately, not for text generation, which can legitimately run for tens
/// of seconds on a slow/local model. 120s is a generous ceiling that still
/// bounds a request — the reason a bound is required at all: `POST
/// /generate` is unauthenticated and LAN-reachable, so with no timeout any
/// caller could open a request that never returns and pin a connection.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(120);

static CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
});

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/models", get(list_models))
        .route("/generate", post(generate_route))
        .with_state(pool)
}

#[derive(Serialize)]
pub struct ModelInfo {
    pub name: String,
}

#[derive(Serialize)]
pub struct ModelsResponse {
    pub models: Vec<ModelInfo>,
}

async fn list_models(State(pool): State<SqlitePool>) -> Result<Json<ModelsResponse>, AppError> {
    let models = list_upstream_models(&pool).await?;
    Ok(Json(ModelsResponse { models }))
}

async fn list_upstream_models(pool: &SqlitePool) -> Result<Vec<ModelInfo>, AppError> {
    let llm = IntegrationConfig::new(pool, "llm");
    let url = llm
        .get("url")
        .await
        .map_err(|_| AppError::BadRequest("llm.url not configured".to_string()))?;

    let resp = CLIENT
        .get(format!("{}/v1/models", url.trim_end_matches('/')))
        .send()
        .await
        .map_err(|e| {
            AppError::Internal(format!("LLM models request failed: {}", e.without_url()))
        })?;

    if !resp.status().is_success() {
        return Err(AppError::Internal(format!(
            "LLM models returned {}",
            resp.status()
        )));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("LLM models parse failed: {}", e.without_url())))?;

    Ok(data["data"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| {
                    m["id"].as_str().map(|id| ModelInfo {
                        name: id.to_string(),
                    })
                })
                .collect()
        })
        .unwrap_or_default())
}

/// The request body for `POST /generate`: `{"model", "prompt"}`.
#[derive(Deserialize)]
pub struct GenerateRequest {
    pub model: String,
    pub prompt: String,
}

#[derive(Serialize)]
pub struct GenerateResponse {
    pub text: String,
}

/// `POST /generate` — a thin HTTP wrapper over [`generate`], letting a
/// browser-side (client) integration run a prompt the same way an
/// in-process one does. See
/// `docs/superpowers/specs/2026-08-05-client-vs-service-integrations.md` for
/// why this crosses no new trust boundary: the backend already proxies
/// arbitrary URLs unauthenticated over `POST /api/fetch`.
async fn generate_route(
    State(pool): State<SqlitePool>,
    Json(req): Json<GenerateRequest>,
) -> Result<Json<GenerateResponse>, AppError> {
    let text = generate(&pool, &req.model, &req.prompt).await?;
    Ok(Json(GenerateResponse { text }))
}

/// Generate a single-prompt completion against the configured openai-compatible
/// endpoint (`llm.url`, hit at `/v1/chat/completions`).
///
/// The internal entry point: `on_this_day` and `sports` call this directly,
/// in-process. `POST /generate` is the HTTP-reachable wrapper over the same
/// function, for a client-side integration that can't call Rust directly.
///
/// Never logs `prompt` or the returned text. On failure the error carries
/// the model name and, for a non-2xx response, the upstream status code —
/// never the response body, which could echo either back.
pub async fn generate(pool: &SqlitePool, model: &str, prompt: &str) -> Result<String, AppError> {
    let llm = IntegrationConfig::new(pool, "llm");
    let url = llm
        .get("url")
        .await
        .map_err(|_| AppError::BadRequest("llm.url not configured".to_string()))?;

    let resp = CLIENT
        .post(format!("{}/v1/chat/completions", url.trim_end_matches('/')))
        .json(&serde_json::json!({
            "model": model,
            "messages": [{ "role": "user", "content": prompt }],
        }))
        .send()
        .await
        .map_err(|e| {
            AppError::Internal(format!(
                "LLM request failed for model '{model}': {}",
                e.without_url()
            ))
        })?;

    if !resp.status().is_success() {
        let status = resp.status();
        return Err(AppError::Internal(format!(
            "LLM returned {status} for model '{model}'"
        )));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| {
        AppError::Internal(format!(
            "LLM parse failed for model '{model}': {}",
            e.without_url()
        ))
    })?;

    Ok(data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string())
}

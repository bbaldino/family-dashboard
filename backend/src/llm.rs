use axum::{Json, Router, extract::State, routing::get};
use serde::Serialize;
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/models", get(list_models))
        .with_state(pool)
}

#[derive(Serialize)]
pub struct ModelInfo {
    pub name: String,
}

#[derive(Serialize)]
pub struct ModelsResponse {
    pub provider: String,
    pub models: Vec<ModelInfo>,
}

async fn list_models(
    State(pool): State<SqlitePool>,
) -> Result<Json<ModelsResponse>, AppError> {
    let llm = IntegrationConfig::new(&pool, "llm");
    let provider = llm.get_or("provider", "ollama").await?;

    let models = match provider.as_str() {
        "ollama" => list_ollama_models(&pool).await?,
        "openai_compat" => list_openai_compat_models(&pool).await?,
        other => {
            return Err(AppError::BadRequest(format!(
                "Unknown llm.provider '{}'",
                other
            )));
        }
    };

    Ok(Json(ModelsResponse { provider, models }))
}

async fn list_ollama_models(pool: &SqlitePool) -> Result<Vec<ModelInfo>, AppError> {
    let ollama = IntegrationConfig::new(pool, "ollama");
    let url = ollama.get_or("url", "http://localhost:11434").await?;
    let token = ollama.get("token").await.ok();

    let client = reqwest::Client::new();
    let mut req = client.get(format!("{}/api/tags", url.trim_end_matches('/')));
    if let Some(token) = &token {
        req = req.bearer_auth(token);
    }

    let resp = req
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Ollama models request failed: {}", e)))?;
    if !resp.status().is_success() {
        return Err(AppError::Internal(format!(
            "Ollama models returned {}",
            resp.status()
        )));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Ollama models parse failed: {}", e)))?;

    Ok(data["models"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| {
                    m["name"].as_str().map(|name| ModelInfo {
                        name: name.to_string(),
                    })
                })
                .collect()
        })
        .unwrap_or_default())
}

async fn list_openai_compat_models(pool: &SqlitePool) -> Result<Vec<ModelInfo>, AppError> {
    let llm = IntegrationConfig::new(pool, "llm");
    let url = llm.get("url").await.map_err(|_| {
        AppError::BadRequest("llm.url not configured for openai_compat provider".to_string())
    })?;

    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{}/v1/models", url.trim_end_matches('/')))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("LLM models request failed: {}", e)))?;

    if !resp.status().is_success() {
        return Err(AppError::Internal(format!(
            "LLM models returned {}",
            resp.status()
        )));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("LLM models parse failed: {}", e)))?;

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

/// Generate a single-prompt completion via the configured LLM provider.
///
/// Provider is selected by `llm.provider` config (defaults to `"ollama"` so
/// existing deployments keep working). Supported values:
///   - `"ollama"`        — POST to `{ollama.url}/api/generate`
///   - `"openai_compat"` — POST to `{llm.url}/v1/chat/completions`
pub async fn generate(pool: &SqlitePool, model: &str, prompt: &str) -> Result<String, AppError> {
    let llm = IntegrationConfig::new(pool, "llm");
    let provider = llm.get_or("provider", "ollama").await?;

    match provider.as_str() {
        "ollama" => generate_ollama(pool, model, prompt).await,
        "openai_compat" => generate_openai_compat(pool, model, prompt).await,
        other => Err(AppError::BadRequest(format!(
            "Unknown llm.provider '{}' (expected 'ollama' or 'openai_compat')",
            other
        ))),
    }
}

async fn generate_ollama(
    pool: &SqlitePool,
    model: &str,
    prompt: &str,
) -> Result<String, AppError> {
    let ollama = IntegrationConfig::new(pool, "ollama");
    let url = ollama.get_or("url", "http://localhost:11434").await?;
    let token = ollama.get("token").await.ok();

    let client = reqwest::Client::new();
    let mut req = client
        .post(format!("{}/api/generate", url.trim_end_matches('/')))
        .json(&serde_json::json!({
            "model": model,
            "prompt": prompt,
            "stream": false,
        }));
    if let Some(token) = &token {
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

    Ok(data["response"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string())
}

async fn generate_openai_compat(
    pool: &SqlitePool,
    model: &str,
    prompt: &str,
) -> Result<String, AppError> {
    let llm = IntegrationConfig::new(pool, "llm");
    let url = llm.get("url").await.map_err(|_| {
        AppError::BadRequest("llm.url not configured for openai_compat provider".to_string())
    })?;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!(
            "{}/v1/chat/completions",
            url.trim_end_matches('/')
        ))
        .json(&serde_json::json!({
            "model": model,
            "messages": [{ "role": "user", "content": prompt }],
        }))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("LLM request failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "LLM returned {} for model '{}': {}",
            status, model, body
        )));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("LLM parse failed: {}", e)))?;

    Ok(data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string())
}

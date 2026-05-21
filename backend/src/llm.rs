use sqlx::SqlitePool;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

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

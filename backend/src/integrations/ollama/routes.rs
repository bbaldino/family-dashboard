use axum::Json;
use axum::extract::State;
use serde::Serialize;
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

#[derive(Serialize)]
pub struct ModelInfo {
    pub name: String,
}

#[derive(Serialize)]
pub struct ModelsResponse {
    pub models: Vec<ModelInfo>,
}

pub async fn get_models(State(pool): State<SqlitePool>) -> Result<Json<ModelsResponse>, AppError> {
    let config = IntegrationConfig::new(&pool, "ollama");
    let url = config.get_or("url", "http://localhost:11434").await?;
    let token = config.get("token").await.ok();

    let client = reqwest::Client::new();
    let mut req = client.get(format!("{}/api/tags", url.trim_end_matches('/')));

    if let Some(token) = &token {
        req = req.bearer_auth(token);
    }

    let resp = req
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Ollama request failed: {}", e)))?;

    if !resp.status().is_success() {
        return Err(AppError::Internal(
            "Failed to fetch Ollama models".to_string(),
        ));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Ollama parse failed: {}", e)))?;

    let models = data["models"]
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
        .unwrap_or_default();

    Ok(Json(ModelsResponse { models }))
}

use std::collections::HashMap;
use std::sync::RwLock;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;
use sqlx::SqlitePool;

pub struct PreviewCache {
    entries: RwLock<HashMap<String, CacheEntry>>,
}

struct CacheEntry {
    summary: String,
    created_at: chrono::DateTime<chrono::Utc>,
}

impl PreviewCache {
    pub fn new() -> Self {
        Self {
            entries: RwLock::new(HashMap::new()),
        }
    }

    pub fn get(&self, game_id: &str) -> Option<String> {
        let entries = self.entries.read().ok()?;
        let entry = entries.get(game_id)?;
        // Cache for 24 hours
        if chrono::Utc::now() - entry.created_at > chrono::Duration::hours(24) {
            return None;
        }
        Some(entry.summary.clone())
    }

    pub fn set(&self, game_id: &str, summary: String) {
        if let Ok(mut entries) = self.entries.write() {
            entries.insert(
                game_id.to_string(),
                CacheEntry {
                    summary,
                    created_at: chrono::Utc::now(),
                },
            );
        }
    }
}

pub async fn generate_preview(pool: &SqlitePool, game_context: &str) -> Result<String, AppError> {
    let config = IntegrationConfig::new(pool, "sports");
    let ollama_url = config
        .get("ollama_url")
        .await
        .map_err(|_| AppError::BadRequest("Ollama URL not configured".to_string()))?;

    let prompt = format!(
        "You are a friendly sports analyst for a family kitchen dashboard. \
         Given the following game information, write a 2-3 sentence preview \
         that covers the matchup context, recent form, and anything notable. \
         Keep it conversational and family-friendly. No stats dumps — just \
         the story of why this game is interesting.\n\n{}",
        game_context
    );

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/api/generate", ollama_url.trim_end_matches('/')))
        .json(&serde_json::json!({
            "model": "llama3.2",
            "prompt": prompt,
            "stream": false,
        }))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Ollama request failed: {}", e)))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!("Ollama error: {}", body)));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Ollama parse failed: {}", e)))?;

    let summary = data["response"]
        .as_str()
        .unwrap_or("Unable to generate preview.")
        .trim()
        .to_string();

    Ok(summary)
}

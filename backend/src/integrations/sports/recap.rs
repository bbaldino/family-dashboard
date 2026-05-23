use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use sqlx::SqlitePool;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

use super::types::Play;

/// In-memory cache of LLM-generated scoring recaps, keyed by
/// `<game_id>:<completed_plays_count>`. Each entry covers a specific snapshot
/// of completed scoring plays, so the key changes whenever a new half-inning
/// with scoring ends. Process-local; restarts wipe it.
#[derive(Default)]
pub struct RecapCache {
    entries: RwLock<HashMap<String, String>>,
    /// Keys for which a generation task is currently in flight — used to
    /// avoid spawning duplicate tasks while one is still running.
    pending: RwLock<std::collections::HashSet<String>>,
}

impl RecapCache {
    pub fn new() -> Self {
        Self {
            entries: RwLock::new(HashMap::new()),
            pending: RwLock::new(std::collections::HashSet::new()),
        }
    }

    pub fn get(&self, key: &str) -> Option<String> {
        self.entries.read().ok()?.get(key).cloned()
    }

    pub fn set(&self, key: String, value: String) {
        if let Ok(mut entries) = self.entries.write() {
            entries.insert(key, value);
        }
    }

    fn try_claim_pending(&self, key: &str) -> bool {
        match self.pending.write() {
            Ok(mut set) => set.insert(key.to_string()),
            Err(_) => false,
        }
    }

    fn release_pending(&self, key: &str) {
        if let Ok(mut set) = self.pending.write() {
            set.remove(key);
        }
    }
}

pub fn cache_key(game_id: &str, completed_plays_count: usize) -> String {
    format!("{}:{}", game_id, completed_plays_count)
}

/// Spawn a background task to generate a recap for `completed_plays` and
/// store the result in `cache` under `key`. Skips if a task for the same key
/// is already pending or if the entry is already cached. Safe to call on
/// every request — the dedupe + cache keep LLM calls to at most one per key.
pub fn ensure_recap(
    cache: Arc<RecapCache>,
    pool: SqlitePool,
    key: String,
    completed_plays: Vec<Play>,
) {
    if cache.get(&key).is_some() {
        return;
    }
    if !cache.try_claim_pending(&key) {
        return;
    }
    tokio::spawn(async move {
        let result = generate_recap(&pool, &completed_plays).await;
        match result {
            Ok(text) => {
                cache.set(key.clone(), text);
            }
            Err(e) => {
                tracing::warn!("Scoring recap generation failed for {}: {}", key, e);
            }
        }
        cache.release_pending(&key);
    });
}

async fn generate_recap(pool: &SqlitePool, plays: &[Play]) -> Result<String, AppError> {
    let sports_config = IntegrationConfig::new(pool, "sports");
    let model = sports_config.get_or("model", "llama3.1:8b").await?;

    let bullets: String = plays
        .iter()
        .map(|p| {
            let inning = match (&p.inning_half, p.inning_number) {
                (Some(half), Some(n)) => format!("{} {}: ", half, n),
                _ => String::new(),
            };
            format!("- {}{}", inning, p.text)
        })
        .collect::<Vec<_>>()
        .join("\n");

    let prompt = format!(
        "You are a baseball analyst for a family kitchen dashboard. Given these \
         scoring plays from a game in chronological order, write a 2-3 sentence \
         narrative recap. Be brief and conversational; mention teams and key \
         players by name. No stat dumps.\n\nScoring plays:\n{}",
        bullets
    );

    crate::llm::generate(pool, &model, &prompt).await
}

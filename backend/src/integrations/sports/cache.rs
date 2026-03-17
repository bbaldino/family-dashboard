use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;

#[derive(Clone)]
struct CacheEntry {
    data: serde_json::Value,
    fetched_at: Instant,
}

#[derive(Clone)]
pub struct EspnCache {
    entries: Arc<RwLock<HashMap<String, CacheEntry>>>,
    live_flag: Arc<RwLock<bool>>,
}

impl EspnCache {
    pub fn new() -> Self {
        Self {
            entries: Arc::new(RwLock::new(HashMap::new())),
            live_flag: Arc::new(RwLock::new(false)),
        }
    }

    pub async fn get(&self, key: &str, max_age_secs: u64) -> Option<serde_json::Value> {
        let entries = self.entries.read().await;
        entries.get(key).and_then(|entry| {
            if entry.fetched_at.elapsed().as_secs() < max_age_secs {
                Some(entry.data.clone())
            } else {
                None
            }
        })
    }

    pub async fn get_stale(&self, key: &str) -> Option<serde_json::Value> {
        let entries = self.entries.read().await;
        entries.get(key).map(|entry| entry.data.clone())
    }

    pub async fn set(&self, key: &str, data: serde_json::Value) {
        let mut entries = self.entries.write().await;
        entries.insert(
            key.to_string(),
            CacheEntry {
                data,
                fetched_at: Instant::now(),
            },
        );
    }

    pub async fn has_live_flag(&self) -> bool {
        *self.live_flag.read().await
    }

    pub async fn set_live_flag(&self, has_live: bool) {
        *self.live_flag.write().await = has_live;
    }
}

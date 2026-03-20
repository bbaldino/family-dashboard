use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;

#[derive(Clone)]
struct CacheEntry {
    duration_seconds: Option<i64>,
    duration_text: Option<String>,
    fetched_at: Instant,
}

#[derive(Clone)]
pub struct DrivingTimeCache {
    entries: Arc<RwLock<HashMap<String, CacheEntry>>>,
}

impl DrivingTimeCache {
    pub fn new() -> Self {
        Self {
            entries: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn get(
        &self,
        destination: &str,
        max_age_secs: u64,
    ) -> Option<(Option<i64>, Option<String>)> {
        let entries = self.entries.read().await;
        let key = normalize_key(destination);
        entries.get(&key).and_then(|entry| {
            if entry.fetched_at.elapsed().as_secs() < max_age_secs {
                Some((entry.duration_seconds, entry.duration_text.clone()))
            } else {
                None
            }
        })
    }

    pub async fn set(
        &self,
        destination: &str,
        duration_seconds: Option<i64>,
        duration_text: Option<String>,
    ) {
        let mut entries = self.entries.write().await;
        let key = normalize_key(destination);
        entries.insert(
            key,
            CacheEntry {
                duration_seconds,
                duration_text,
                fetched_at: Instant::now(),
            },
        );
    }
}

fn normalize_key(destination: &str) -> String {
    destination.to_lowercase().trim().to_string()
}

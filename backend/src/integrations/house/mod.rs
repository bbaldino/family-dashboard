use std::collections::HashMap;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::Arc;
use std::sync::RwLock;

use axum::extract::State;
use axum::{Json, Router, routing::post};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

pub struct StandfirstCache {
    entries: RwLock<HashMap<String, CacheEntry>>,
}

struct CacheEntry {
    summary: String,
    created_at: chrono::DateTime<chrono::Utc>,
}

impl Default for StandfirstCache {
    fn default() -> Self {
        Self::new()
    }
}

impl StandfirstCache {
    pub fn new() -> Self {
        Self {
            entries: RwLock::new(HashMap::new()),
        }
    }

    pub fn get(&self, key: &str) -> Option<String> {
        let entries = self.entries.read().ok()?;
        let entry = entries.get(key)?;
        // Cache for 24 hours
        if chrono::Utc::now() - entry.created_at > chrono::Duration::hours(24) {
            return None;
        }
        Some(entry.summary.clone())
    }

    pub fn set(&self, key: &str, summary: String) {
        if let Ok(mut entries) = self.entries.write() {
            entries.insert(
                key.to_string(),
                CacheEntry {
                    summary,
                    created_at: chrono::Utc::now(),
                },
            );
        }
    }
}

/// A stable key for a facts block, used to look the cached standfirst up
/// without ever storing the facts themselves as the key.
fn facts_key(facts: &str) -> String {
    let mut hasher = DefaultHasher::new();
    facts.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

#[derive(Clone)]
struct HouseState {
    pool: SqlitePool,
    standfirst_cache: Arc<StandfirstCache>,
}

pub fn router(pool: SqlitePool) -> Router {
    let state = HouseState {
        pool,
        standfirst_cache: Arc::new(StandfirstCache::new()),
    };

    Router::new()
        .route("/standfirst", post(post_standfirst))
        .with_state(state)
}

#[derive(Deserialize)]
struct StandfirstRequest {
    facts: String,
}

#[derive(Serialize)]
struct StandfirstResponse {
    summary: String,
}

async fn post_standfirst(
    State(state): State<HouseState>,
    Json(req): Json<StandfirstRequest>,
) -> Result<Json<StandfirstResponse>, AppError> {
    let key = facts_key(&req.facts);
    if let Some(summary) = state.standfirst_cache.get(&key) {
        return Ok(Json(StandfirstResponse { summary }));
    }

    let house_config = IntegrationConfig::new(&state.pool, "house");
    let model = house_config.get_or("model", "sonnet").await?;
    let prompt = build_prompt(&req.facts);

    let summary = crate::llm::generate(&state.pool, &model, &prompt)
        .await?
        .trim()
        .to_string();

    state.standfirst_cache.set(&key, summary.clone());
    Ok(Json(StandfirstResponse { summary }))
}

fn build_prompt(facts: &str) -> String {
    format!(
        r#"You write "From the House" — the standfirst on a family's kitchen wall display: one warm, wry, observant sentence summing up the day, in the voice of the household itself. (It is signed "— warmly, the house" elsewhere; do NOT write a sign-off.)

The personality is the point — keep it. But it comes from how you phrase what is *actually happening* — a dry, affectionate turn on a real fact — NOT from adding a closing thought, a life-lesson, a joke, or an assumption about the family. Land the sentence on one of the facts, never on a flourish or an aside.

Examples of the register (different days, for tone only — don't reuse their wording):
- Groceries by ten, then straight into the birthday party at one, under a bright and sunny 82.
- The afternoon stacks up — soccer, then piano, then book club — with the game on tonight at ten past seven.
- A quiet Wednesday, nothing on the books and a soft 72 and overcast to match.
- A hot, clear Tuesday with an empty calendar.

Hard rules:
- Output ONLY the sentence — no preamble, quotes, markdown, or emoji.
- Use ONLY the facts given. Never invent an event, name, score, place, or detail not listed; omit what isn't provided rather than guessing.
- If a birthday is listed, open by wishing that person a happy birthday by name — turn "Grandpa's Birthday" into "Happy birthday, Grandpa!" — then follow with the rest of the day if there is any. (The one time the line may lead with a warm address rather than a fact.)
- No live game scores or innings — a game is just "tonight," "on now," or its final result.
- A game that hasn't started yet is "tonight" or its start time — never "underway" or "on now" until it actually is.
- Present tense. Let the time of day colour it.

Today:
{facts}

Write the line."#
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn facts_key_is_stable_for_the_same_input() {
        let facts = "Weather: sunny, 82. Calendar: birthday party at 1pm.";
        assert_eq!(facts_key(facts), facts_key(facts));
    }

    #[test]
    fn facts_key_differs_for_different_input() {
        let a = "Weather: sunny, 82.";
        let b = "Weather: overcast, 72.";
        assert_ne!(facts_key(a), facts_key(b));
    }

    #[test]
    fn standfirst_cache_round_trips_within_ttl() {
        let cache = StandfirstCache::new();
        cache.set("key1", "A quiet Wednesday.".to_string());
        assert_eq!(cache.get("key1"), Some("A quiet Wednesday.".to_string()));
    }

    #[test]
    fn standfirst_cache_misses_on_unknown_key() {
        let cache = StandfirstCache::new();
        assert_eq!(cache.get("nope"), None);
    }
}

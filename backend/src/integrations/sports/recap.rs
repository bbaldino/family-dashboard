use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use sqlx::SqlitePool;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

use super::types::{InningRef, Play};

/// Game context passed to the LLM so it can frame the recap correctly
/// (which inning is being summarized vs. where the game currently stands).
#[derive(Clone, Debug)]
pub struct RecapContext {
    pub through_inning: Option<InningRef>,
    /// Period label as the user is currently seeing it on the dashboard,
    /// e.g. "Top 5th" / "Mid 5th" / "Bot 5th". Used to anchor the LLM in
    /// "the game is currently here" so it doesn't sound like a final recap.
    pub current_period_label: Option<String>,
    pub home_abbr: String,
    pub away_abbr: String,
    /// Map of team_id → abbreviation so we can tag each scoring play with
    /// which side scored.
    pub team_abbrs: std::collections::HashMap<String, String>,
}

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
    ctx: RecapContext,
) {
    if cache.get(&key).is_some() {
        return;
    }
    if !cache.try_claim_pending(&key) {
        return;
    }
    tokio::spawn(async move {
        let result = generate_recap(&pool, &completed_plays, &ctx).await;
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

fn format_inning(half: &str, number: u32) -> String {
    let suffix = match number % 100 {
        11..=13 => "th",
        _ => match number % 10 {
            1 => "st",
            2 => "nd",
            3 => "rd",
            _ => "th",
        },
    };
    format!("{} of the {}{}", half.to_lowercase(), number, suffix)
}

async fn generate_recap(
    pool: &SqlitePool,
    plays: &[Play],
    ctx: &RecapContext,
) -> Result<String, AppError> {
    let sports_config = IntegrationConfig::new(pool, "sports");
    let model = sports_config.get_or("model", "llama3.1:8b").await?;

    let bullets: String = plays
        .iter()
        .map(|p| {
            let inning = match (&p.inning_half, p.inning_number) {
                (Some(half), Some(n)) => format!("{} {}: ", half, n),
                _ => String::new(),
            };
            let team_tag = p
                .team_id
                .as_ref()
                .and_then(|id| ctx.team_abbrs.get(id))
                .map(|abbr| format!("[{}] ", abbr))
                .unwrap_or_default();
            format!("- {}{}{}", inning, team_tag, p.text)
        })
        .collect::<Vec<_>>()
        .join("\n");

    let through = ctx
        .through_inning
        .as_ref()
        .map(|i| format_inning(&i.half, i.number))
        .unwrap_or_else(|| "the early innings".to_string());

    let current = ctx
        .current_period_label
        .clone()
        .unwrap_or_else(|| "later in the game".to_string());

    let prompt = format!(
        "You are a baseball analyst for a family kitchen dashboard. \
         The game between the {away} and the {home} is in progress — currently {current}. \
         Below are every scoring play through {through}, in chronological order. \
         Write a 2-3 sentence narrative recap of how the scoring has unfolded \
         through that point. Use past tense for what happened. Do NOT use \
         wrap-up language like 'ultimately', 'in the end', 'finally', or \
         declare a winner — the game is still going. Mention teams and key \
         players by name. No stat dumps.\n\n\
         Scoring plays (team prefix in brackets):\n{bullets}",
        away = ctx.away_abbr,
        home = ctx.home_abbr,
        current = current,
        through = through,
        bullets = bullets,
    );

    crate::llm::generate(pool, &model, &prompt).await
}

use std::collections::HashMap;
use std::sync::RwLock;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;
use sqlx::SqlitePool;

pub struct FinalRecapCache {
    entries: RwLock<HashMap<String, CacheEntry>>,
}

struct CacheEntry {
    summary: String,
    created_at: chrono::DateTime<chrono::Utc>,
}

impl FinalRecapCache {
    pub fn new() -> Self {
        Self {
            entries: RwLock::new(HashMap::new()),
        }
    }

    pub fn get(&self, game_id: &str) -> Option<String> {
        let entries = self.entries.read().ok()?;
        let entry = entries.get(game_id)?;
        // Cache for 24 hours — recaps don't change after the final buzzer.
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

impl Default for FinalRecapCache {
    fn default() -> Self {
        Self::new()
    }
}

pub async fn generate_final_recap(
    pool: &SqlitePool,
    game_context: &str,
) -> Result<String, AppError> {
    let sports_config = IntegrationConfig::new(pool, "sports");
    let model = sports_config.get_or("model", "llama3.1:8b").await?;

    let prompt = format!(
        "You're a casual sports fan telling a friend what happened in tonight's game. \
         Write 3-4 sentences for a wall-mounted kitchen dashboard.\n\n\
         Lead with the outcome or the moment that decided it — a name, a play, a run, \
         a comeback. Weave in the strongest supporting angles from the leaders, recent-form, \
         prior-season, and news blocks below; two threads is fine when they earn it. \
         Use vivid, past-tense, plainspoken language. Family-friendly.\n\n\
         Grounding rules (strict):\n\
         - Only reference player names, trades, stats, or facts that appear \
         verbatim in the game information block below. Do NOT rely on prior \
         knowledge about rosters, star players, or league history — rosters \
         change every year and training-data recall is stale.\n\
         - If a name doesn't appear in the game information, don't mention it. \
         Refer to teams by team name only.\n\n\
         Format rules (strict):\n\
         - Output ONLY the recap text. No preamble, no headers, no bullet points, \
         no markdown formatting (no **, no ##, no ---), no \"Sources:\" section, \
         no meta-commentary about the game or your process.\n\
         - Do not start with phrases like \"Here's...\", \"This recap...\", \
         \"Let me...\", or explain what you're doing.\n\
         - Plain prose only.\n\n\
         Game information:\n{}",
        game_context
    );

    let raw = crate::llm::generate(pool, &model, &prompt).await?;
    let cleaned = super::preview::clean_preview(&raw);
    if cleaned.is_empty() {
        return Ok("Unable to generate recap.".to_string());
    }
    Ok(cleaned)
}

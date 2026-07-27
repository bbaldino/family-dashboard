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
    let sports_config = IntegrationConfig::new(pool, "sports");
    let model = sports_config.get_or("model", "llama3.1:8b").await?;

    // The response goes straight to a wall-mounted kitchen dashboard, so no
    // preamble, no markdown, no sources, no meta-commentary. Chat-tuned
    // models (Claude, ChatGPT, etc.) love to wrap answers in "Here's your
    // preview:" and drop bold/heading formatting; the constraints below plus
    // the post-processor in `clean_preview` keep the wall display clean.
    let prompt = format!(
        "You're a casual sports fan telling a friend what's fun about tonight's game. \
         Write 3-4 sentences for a wall-mounted kitchen dashboard.\n\n\
         Open with a specific hook — a name, a streak, a storyline, a stakes-line — \
         not a generic setup. Weave in the strongest angles from the recent-form, \
         prior-season, and news blocks below; two threads is fine when they earn it. \
         Use vivid, plainspoken language. Family-friendly.\n\n\
         Format rules (strict):\n\
         - Output ONLY the preview text. No preamble, no headers, no bullet points, \
         no markdown formatting (no **, no ##, no ---), no \"Sources:\" section, \
         no meta-commentary about the game or your process.\n\
         - Do not start with phrases like \"Here's...\", \"This preview...\", \
         \"Let me...\", or explain what you're doing.\n\
         - Plain prose only.\n\n\
         Game information:\n{}",
        game_context
    );

    let raw = crate::llm::generate(pool, &model, &prompt).await?;
    let cleaned = clean_preview(&raw);
    if cleaned.is_empty() {
        return Ok("Unable to generate preview.".to_string());
    }
    Ok(cleaned)
}

/// Strip common chat-model wrappers: leading assistant preamble, markdown
/// separators / bold / headers, and a trailing "Sources:" block.
fn clean_preview(raw: &str) -> String {
    let mut text = raw.trim().to_string();

    // Chop off a trailing sources / references block if the model added one.
    for marker in ["**Sources:", "## Sources", "Sources:", "**References:"] {
        if let Some(idx) = text.find(marker) {
            text.truncate(idx);
        }
    }

    // If the model wrapped the preview between `---` separators, keep only
    // what's between the first pair.
    if let (Some(start), Some(rest_start)) = (text.find("---"), text.find("---").map(|i| i + 3)) {
        let after = &text[rest_start..];
        if let Some(end_rel) = after.find("---") {
            text = after[..end_rel].to_string();
        } else {
            // Only one separator — drop everything before it (it was the preamble/tool-call
            // fence).
            text = text[start + 3..].to_string();
        }
    }

    // Strip a lingering preamble line if the model still leads with "Here's..."
    // or a labeled header on its own line.
    let leading_preamble_prefixes = [
        "here's",
        "here is",
        "sure,",
        "of course",
        "i'd love",
        "let me",
        "preview:",
        "game preview:",
    ];
    if let Some(line_end) = text.find('\n') {
        let first_line = text[..line_end].trim().to_ascii_lowercase();
        if leading_preamble_prefixes
            .iter()
            .any(|p| first_line.starts_with(p))
        {
            text = text[line_end + 1..].to_string();
        }
    }

    // Drop markdown emphasis / heading markers inline. Keep the words.
    text = text.replace("**", "").replace("__", "");
    text = text
        .lines()
        .map(|line| line.trim_start_matches(['#', ' ']).to_string())
        .collect::<Vec<_>>()
        .join("\n");

    text.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clean_preview_strips_preamble_separators_and_sources() {
        let raw = "I'd love to help. Let me search for their status:Perfect! Now I have the \
                   context. Here's your preview: --- **Lakers vs Kings** The Lakers kick off \
                   their preseason against the Kings tonight. It's exhibition time. --- \
                   **Sources:** - [ESPN](https://espn.com)";
        let cleaned = clean_preview(raw);
        assert!(cleaned.starts_with("Lakers vs Kings"), "got: {cleaned}");
        assert!(!cleaned.contains("Sources"));
        assert!(!cleaned.contains("**"));
        assert!(!cleaned.contains("---"));
    }

    #[test]
    fn clean_preview_leaves_plain_text_alone() {
        let raw = "The Dodgers host the Padres tonight in a key NL West matchup.";
        assert_eq!(clean_preview(raw), raw);
    }

    #[test]
    fn clean_preview_strips_leading_here_is() {
        let raw = "Here's the preview:\nThe Lakers travel to Sacramento.";
        assert_eq!(clean_preview(raw), "The Lakers travel to Sacramento.");
    }

    #[test]
    fn clean_preview_strips_headers_and_bold() {
        let raw = "## Preview\n**The Kings** open their season tonight.";
        assert_eq!(
            clean_preview(raw),
            "Preview\nThe Kings open their season tonight."
        );
    }
}

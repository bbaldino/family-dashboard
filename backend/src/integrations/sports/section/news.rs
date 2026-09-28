use super::MoreStory;

// ─── News ────────────────────────────────────────────────────────────────

/// Normalise a string to lowercase alphanumerics, for comparing a headline
/// against its description.
fn normalise(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric())
        .flat_map(|c| c.to_lowercase())
        .collect()
}

/// A description that only echoes its headline carries no information as text —
/// mostly video segments whose "description" repeats the title. Drop those.
fn is_headline_echo(headline: &str, description: &str) -> bool {
    let (h, d) = (normalise(headline), normalise(description));
    d.is_empty() || d == h || h.contains(&d) || d.contains(&h)
}

/// The number of teams an article is tagged with. A genuine team story tags one
/// or two; a league round-up tags twenty or thirty. `<= 3` separates them.
fn team_tag_count(article: &serde_json::Value) -> usize {
    article
        .get("categories")
        .and_then(|c| c.as_array())
        .map(|arr| {
            arr.iter()
                .filter(|c| c.get("type").and_then(|t| t.as_str()) == Some("team"))
                .count()
        })
        .unwrap_or(0)
}

/// ESPN's recap deks open with a stray em-dash byline marker (`"— Logan
/// Henderson allowed one run…"`). Strip it so the dek reads clean — and so the
/// standfirst, which is the lead dek, doesn't collide with the frontend's own
/// trailing "— warmly, the house".
fn clean_dek(dek: &str) -> String {
    dek.trim_start_matches('—').trim_start().to_string()
}

pub struct NewsShape {
    pub headline: String,
    pub dek: String,
    /// The lead story's meta line, for an Elsewhere entry that shows one story.
    pub lead_meta: String,
    pub more: Vec<MoreStory>,
}

fn article_meta(article: &serde_json::Value) -> String {
    let when = article
        .get("published")
        .and_then(|p| p.as_str())
        .and_then(super::super::transform::parse_espn_timestamp)
        .map(|dt| dt.format("%a %b %-d").to_string())
        .unwrap_or_default();
    let kind = article.get("type").and_then(|t| t.as_str()).unwrap_or("");
    match (when.is_empty(), kind.is_empty()) {
        (false, false) => format!("{when} · {kind}"),
        (false, true) => when,
        _ => kind.to_string(),
    }
}

/// The lead story and two follow-ups from a team's news feed, after dropping
/// league round-ups (too many team tags) and headline-echo items (no text
/// beyond the headline). Everything left is a real, readable team story.
pub fn shape_news(articles: &[serde_json::Value]) -> NewsShape {
    let kept: Vec<&serde_json::Value> = articles
        .iter()
        .filter(|a| {
            let headline = a.get("headline").and_then(|h| h.as_str()).unwrap_or("");
            let desc = a.get("description").and_then(|d| d.as_str()).unwrap_or("");
            !headline.is_empty() && team_tag_count(a) <= 3 && !is_headline_echo(headline, desc)
        })
        .collect();

    let text = |a: &serde_json::Value, key: &str| {
        a.get(key)
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string()
    };

    NewsShape {
        headline: kept
            .first()
            .map(|a| text(a, "headline"))
            .unwrap_or_default(),
        dek: kept
            .first()
            .map(|a| clean_dek(&text(a, "description")))
            .unwrap_or_default(),
        lead_meta: kept.first().map(|a| article_meta(a)).unwrap_or_default(),
        more: kept
            .iter()
            .skip(1)
            .take(2)
            .map(|a| MoreStory {
                h: text(a, "headline"),
                dek: clean_dek(&text(a, "description")),
                meta: article_meta(a),
            })
            .collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn article(headline: &str, desc: &str, team_tags: usize) -> serde_json::Value {
        let cats: Vec<_> = (0..team_tags)
            .map(|_| serde_json::json!({ "type": "team" }))
            .collect();
        serde_json::json!({
            "headline": headline,
            "description": desc,
            "type": "Story",
            "published": "2026-08-12T14:00Z",
            "categories": cats,
        })
    }

    #[test]
    fn news_drops_league_roundups_and_keeps_team_stories() {
        let articles = vec![
            article(
                "10 storylines that will shape the season",
                "A league-wide look.",
                30,
            ),
            article("Muncy walks it off", "A single scored Ohtani to end it.", 2),
            article(
                "Snell strikes out ten",
                "Back from the IL after three months.",
                1,
            ),
        ];
        let n = shape_news(&articles);
        // The 30-team round-up is skipped; the first real team story leads.
        assert_eq!(n.headline, "Muncy walks it off");
        assert_eq!(n.dek, "A single scored Ohtani to end it.");
        assert_eq!(n.more.len(), 1);
        assert_eq!(n.more[0].h, "Snell strikes out ten");
        assert_eq!(n.more[0].meta, "Wed Aug 12 · Story");
    }

    #[test]
    fn news_drops_headline_echo_items() {
        let articles = vec![
            // A video whose description just repeats the headline.
            article(
                "Royals vs. Dodgers: Game Highlights",
                "Royals vs. Dodgers: Game Highlights",
                2,
            ),
            article(
                "Real story with a real dek",
                "Something that isn't the headline.",
                1,
            ),
        ];
        let n = shape_news(&articles);
        assert_eq!(n.headline, "Real story with a real dek");
    }
}

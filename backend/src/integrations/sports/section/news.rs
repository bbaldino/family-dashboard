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
/// Henderson allowed one run…"`). Strip it so the dek reads clean.
fn clean_dek(dek: &str) -> String {
    dek.trim_start_matches('—').trim_start().to_string()
}

/// A readable story: has a headline, isn't a league round-up (too many team
/// tags), and says more than its own headline.
fn keep_article(a: &serde_json::Value) -> bool {
    let headline = a["headline"].as_str().unwrap_or("");
    let desc = a["description"].as_str().unwrap_or("");
    !headline.is_empty() && team_tag_count(a) <= 3 && !is_headline_echo(headline, desc)
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
    let kept: Vec<&serde_json::Value> = articles.iter().filter(|a| keep_article(a)).collect();

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

#[derive(serde::Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum BriefSource {
    Team,
    League,
}

#[derive(serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BriefItem {
    pub h: String,
    pub dek: Option<String>,
    pub source: BriefSource,
    pub tag: String,
    pub published_at: String,
}

fn to_item(a: &serde_json::Value, source: BriefSource, tag: &str) -> BriefItem {
    let dek = clean_dek(a["description"].as_str().unwrap_or(""));
    BriefItem {
        h: a["headline"].as_str().unwrap_or("").to_string(),
        dek: (!dek.is_empty()).then_some(dek),
        source,
        tag: tag.to_string(),
        published_at: a["published"].as_str().unwrap_or("").to_string(),
    }
}

/// Newest first; undated (empty `published_at`) last. RFC 3339 UTC strings
/// from one feed sort correctly as text.
fn newest_first(items: &mut [BriefItem]) {
    items.sort_by(
        |x, y| match (x.published_at.is_empty(), y.published_at.is_empty()) {
            (true, false) => std::cmp::Ordering::Greater,
            (false, true) => std::cmp::Ordering::Less,
            _ => y.published_at.cmp(&x.published_at),
        },
    );
}

/// The column's In brief: the team's own stories, then the league's, each
/// newest first. A league story already in the team list (same id, or the
/// same headline) appears once, as a team item.
pub fn brief_items(
    team: &[serde_json::Value],
    league: &[serde_json::Value],
    team_tag: &str,
    league_tag: &str,
) -> Vec<BriefItem> {
    let team_kept: Vec<&serde_json::Value> = team.iter().filter(|a| keep_article(a)).collect();
    let ids: std::collections::HashSet<String> = team_kept
        .iter()
        .filter_map(|a| super::super::transform::json_id(&a["id"]))
        .collect();
    let heads: std::collections::HashSet<String> = team_kept
        .iter()
        .map(|a| normalise(a["headline"].as_str().unwrap_or("")))
        .collect();

    let mut team_items: Vec<BriefItem> = team_kept
        .iter()
        .map(|a| to_item(a, BriefSource::Team, team_tag))
        .collect();
    let mut league_items: Vec<BriefItem> = league
        .iter()
        .filter(|a| keep_article(a))
        .filter(|a| {
            let dup_id =
                super::super::transform::json_id(&a["id"]).is_some_and(|id| ids.contains(&id));
            let dup_head = heads.contains(&normalise(a["headline"].as_str().unwrap_or("")));
            !dup_id && !dup_head
        })
        .map(|a| to_item(a, BriefSource::League, league_tag))
        .collect();
    newest_first(&mut team_items);
    newest_first(&mut league_items);
    team_items.extend(league_items);
    team_items
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

    const NFL_NEWS: &str = include_str!("../../../../tests/fixtures/section/nfl_league_news.json");

    fn articles(json: &str) -> Vec<serde_json::Value> {
        let v: serde_json::Value = serde_json::from_str(json).unwrap();
        v["articles"].as_array().unwrap().clone()
    }

    /// Real league feed: out of `published` order, one headline-echo video.
    #[test]
    fn league_items_are_filtered_and_newest_first() {
        let items = brief_items(&[], &articles(NFL_NEWS), "49ers", "NFL");
        let heads: Vec<&str> = items.iter().map(|i| i.h.as_str()).collect();
        assert_eq!(heads.len(), 5, "the echo video is dropped");
        assert!(heads[0].starts_with("Fantasy football buzz"));
        assert!(heads[1].starts_with("Sources: Panthers CB Jaycee Horn"));
        assert!(!heads.iter().any(|h| h.starts_with("Rich Eisen")));
        assert!(items.iter().all(|i| i.tag == "NFL"));
    }

    #[test]
    fn team_items_lead_and_a_league_duplicate_appears_once() {
        let dup = serde_json::json!({
            "id": 50052996,
            "headline": "Buccaneers' Mayfield (thumb) out at least three weeks, Bowles says",
            "description": "Baker Mayfield is expected to miss at least three weeks.",
            "published": "2026-09-28T17:19:55Z",
            "categories": [{ "type": "team" }],
        });
        let items = brief_items(&[dup], &articles(NFL_NEWS), "Buccaneers", "NFL");
        assert_eq!(items[0].tag, "Buccaneers");
        assert_eq!(
            items
                .iter()
                .filter(|i| i.h.starts_with("Buccaneers' Mayfield"))
                .count(),
            1
        );
    }

    /// Numeric ids, missing `published`: no panic, undated sorts last.
    #[test]
    fn undated_items_sort_last_without_panicking() {
        let a = serde_json::json!({ "id": 1, "headline": "Dated", "description": "A real dek.", "published": "2026-09-28T10:00:00Z" });
        let b = serde_json::json!({ "id": 2, "headline": "Undated", "description": "Another real dek." });
        let items = brief_items(&[b, a], &[], "49ers", "NFL");
        assert_eq!(
            items.iter().map(|i| i.h.as_str()).collect::<Vec<_>>(),
            ["Dated", "Undated"]
        );
        assert_eq!(items[1].published_at, "");
    }

    #[test]
    fn deks_are_cleaned_of_the_byline_dash() {
        let a = serde_json::json!({ "id": 1, "headline": "Snell strikes out ten", "description": "— Back from the IL.", "published": "2026-09-28T10:00:00Z" });
        let items = brief_items(&[a], &[], "Dodgers", "MLB");
        assert_eq!(items[0].dek.as_deref(), Some("Back from the IL."));
    }
}

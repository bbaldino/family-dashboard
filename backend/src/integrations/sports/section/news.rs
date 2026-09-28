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
/// newest first. A story appears once (same id, or the same headline): a
/// league story already in the team list stays a team item, and a feed that
/// repeats a story keeps its first copy.
pub fn brief_items(
    team: &[serde_json::Value],
    league: &[serde_json::Value],
    team_tag: &str,
    league_tag: &str,
) -> Vec<BriefItem> {
    let mut ids = std::collections::HashSet::new();
    let mut heads = std::collections::HashSet::new();
    let mut first_copy = |a: &serde_json::Value| {
        let id = super::super::transform::json_id(&a["id"]);
        let head = normalise(a["headline"].as_str().unwrap_or(""));
        if id.as_ref().is_some_and(|id| ids.contains(id)) || heads.contains(&head) {
            return false;
        }
        ids.extend(id);
        heads.insert(head);
        true
    };
    let mut items = |feed: &[serde_json::Value], source, tag: &str| {
        let mut items: Vec<BriefItem> = feed
            .iter()
            .filter(|a| keep_article(a) && first_copy(a))
            .map(|a| to_item(a, source, tag))
            .collect();
        newest_first(&mut items);
        items
    };
    let mut team_items = items(team, BriefSource::Team, team_tag);
    team_items.extend(items(league, BriefSource::League, league_tag));
    team_items
}

#[cfg(test)]
mod tests {
    use super::*;

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

    /// A league round-up tags twenty or thirty teams; a video's "description"
    /// can just repeat its headline. Neither is a readable team story.
    #[test]
    fn team_feed_drops_roundups_and_headline_echoes() {
        let teams = |n: usize| vec![serde_json::json!({ "type": "team" }); n];
        let feed = [
            serde_json::json!({ "headline": "10 storylines that will shape the season", "description": "A league-wide look.", "categories": teams(30) }),
            serde_json::json!({ "headline": "Royals vs. Dodgers: Game Highlights", "description": "Royals vs. Dodgers: Game Highlights", "categories": teams(2) }),
            serde_json::json!({ "headline": "Muncy walks it off", "description": "A single scored Ohtani to end it.", "categories": teams(2) }),
        ];
        let items = brief_items(&feed, &[], "Dodgers", "MLB");
        assert_eq!(
            items.iter().map(|i| i.h.as_str()).collect::<Vec<_>>(),
            ["Muncy walks it off"]
        );
    }

    /// ESPN's team feed can list one story twice (a re-post under a new id,
    /// or the same id twice): it reads once, in either feed.
    #[test]
    fn a_story_repeated_within_a_feed_appears_once() {
        let story = |id: i64, head: &str| serde_json::json!({ "id": id, "headline": head, "description": "A real dek.", "published": "2026-09-28T10:00:00Z" });
        let team = [
            story(1, "Snell strikes out ten"),
            story(2, "Snell strikes out ten"),
            story(3, "Muncy walks it off"),
            story(3, "Muncy walks it off!"),
        ];
        let league = [story(8, "Judge hits 60th"), story(9, "Judge hits 60th")];
        let items = brief_items(&team, &league, "Dodgers", "MLB");
        assert_eq!(
            items.iter().map(|i| i.h.as_str()).collect::<Vec<_>>(),
            [
                "Snell strikes out ten",
                "Muncy walks it off",
                "Judge hits 60th"
            ]
        );
    }

    #[test]
    fn deks_are_cleaned_of_the_byline_dash() {
        let a = serde_json::json!({ "id": 1, "headline": "Snell strikes out ten", "description": "— Back from the IL.", "published": "2026-09-28T10:00:00Z" });
        let items = brief_items(&[a], &[], "Dodgers", "MLB");
        assert_eq!(items[0].dek.as_deref(), Some("Back from the IL."));
    }
}

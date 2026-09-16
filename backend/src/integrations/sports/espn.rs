use crate::error::AppError;

const ESPN_BASE: &str = "https://site.api.espn.com/apis/site/v2/sports";

/// The inclusive list of `YYYYMMDD` days to ask ESPN's scoreboard for, one
/// request per day (ESPN 400s on the `YYYYMMDD-YYYYMMDD` range syntax it used
/// to accept).
///
/// The scoreboard endpoint takes no date at all if you don't give it one, and
/// what it returns then is *not* today: at 14:33 UTC on 2026-08-10 an undated
/// request answered with the whole of the 9th, every game `post`. The column
/// went on reporting an off-day all morning while that night's first pitch was
/// already on the schedule. So the date is always sent explicitly.
///
/// The span is derived from `window_hours` rather than fixed, because that is
/// the filter the payload has to survive: `transform_scoreboard` keeps finals
/// that started within `window_hours` behind us and games starting within
/// `window_hours` ahead, so a fetch narrower than that silently starves it.
/// One extra day on each end covers the offset between ESPN's game-day
/// numbering — a 7:10pm Pacific game sits on the 10th's slate but carries a
/// UTC timestamp on the 11th — and the UTC date this is computed from.
pub fn scoreboard_days(now: chrono::DateTime<chrono::Utc>, window_hours: f64) -> Vec<String> {
    let span = chrono::Duration::days(1 + (window_hours / 24.0).ceil().max(0.0) as i64);
    let start = (now - span).date_naive();
    let end = (now + span).date_naive();

    let mut days = Vec::new();
    let mut day = start;
    while day <= end {
        days.push(day.format("%Y%m%d").to_string());
        day += chrono::Duration::days(1);
    }
    days
}

pub async fn fetch_scoreboard(
    client: &reqwest::Client,
    sport: &str,
    league: &str,
    dates: &str,
) -> Result<serde_json::Value, AppError> {
    let url = format!(
        "{}/{}/{}/scoreboard?dates={}",
        ESPN_BASE, sport, league, dates
    );
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("ESPN request failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "ESPN API error ({}): {}",
            status, body
        )));
    }

    resp.json()
        .await
        .map_err(|e| AppError::Internal(format!("ESPN parse failed: {}", e)))
}

/// Merge one day's worth of per-day scoreboard responses (`fetch_scoreboard`
/// called once per day, per `scoreboard_days`) into a single scoreboard-shaped
/// JSON value: `events` arrays are concatenated (de-duped by `id`, order
/// preserved), and the other top-level fields (`leagues`, `season`, `day`,
/// ...) are carried over from the first day that returned anything.
///
/// A day that individually failed is tolerated — only `Err` if every day
/// failed, since then there is nothing to show at all.
pub async fn fetch_scoreboard_window(
    client: &reqwest::Client,
    sport: &str,
    league: &str,
    days: &[String],
) -> Result<serde_json::Value, AppError> {
    let fetches = days
        .iter()
        .map(|day| fetch_scoreboard(client, sport, league, day));
    let results = futures::future::join_all(fetches).await;

    let day_values: Vec<serde_json::Value> = results.into_iter().flatten().collect();

    if day_values.is_empty() {
        return Err(AppError::Internal(format!(
            "ESPN API error: all {} day request(s) failed for {}/{}",
            days.len(),
            sport,
            league
        )));
    }

    Ok(merge_scoreboards(&day_values))
}

/// See `fetch_scoreboard_window`. Split out and kept pure so the merge logic
/// itself is unit-testable without any I/O.
fn merge_scoreboards(day_values: &[serde_json::Value]) -> serde_json::Value {
    let mut merged = day_values[0].clone();

    let mut seen_ids = std::collections::HashSet::new();
    let mut events = Vec::new();
    for day_value in day_values {
        let Some(day_events) = day_value["events"].as_array() else {
            continue;
        };
        for event in day_events {
            let id = event["id"].as_str().map(|s| s.to_string());
            let is_new = match &id {
                Some(id) => seen_ids.insert(id.clone()),
                // No id to de-dupe on — keep it rather than risk dropping a game.
                None => true,
            };
            if is_new {
                events.push(event.clone());
            }
        }
    }

    merged["events"] = serde_json::Value::Array(events);
    merged
}

pub async fn fetch_teams(
    client: &reqwest::Client,
    sport: &str,
    league: &str,
) -> Result<serde_json::Value, AppError> {
    let url = format!("{}/{}/{}/teams?limit=100", ESPN_BASE, sport, league);
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("ESPN teams request failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "ESPN teams API error ({}): {}",
            status, body
        )));
    }

    resp.json()
        .await
        .map_err(|e| AppError::Internal(format!("ESPN teams parse failed: {}", e)))
}

pub async fn fetch_summary(
    client: &reqwest::Client,
    sport: &str,
    league: &str,
    event_id: &str,
) -> Result<serde_json::Value, AppError> {
    let url = format!(
        "{}/{}/{}/summary?event={}",
        ESPN_BASE, sport, league, event_id
    );
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("ESPN summary request failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "ESPN summary API error ({}): {}",
            status, body
        )));
    }

    resp.json()
        .await
        .map_err(|e| AppError::Internal(format!("ESPN summary parse failed: {}", e)))
}

/// GET any absolute ESPN URL as JSON. The section aggregation reaches three
/// hosts — `site.api` (team detail, news), `apis/v2` (standings), and
/// `sports.core.api` (leaders and the `$ref`s under them) — so it needs a
/// fetcher that takes a whole URL rather than composing one from a base.
pub async fn fetch_json(
    client: &reqwest::Client,
    url: &str,
) -> Result<serde_json::Value, AppError> {
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("ESPN request failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        return Err(AppError::Internal(format!("ESPN API error ({})", status)));
    }

    resp.json()
        .await
        .map_err(|e| AppError::Internal(format!("ESPN parse failed: {}", e)))
}

/// A team's detail (record, standing, next event).
pub fn team_detail_url(sport: &str, league: &str, team_id: &str) -> String {
    format!("{ESPN_BASE}/{sport}/{league}/teams/{team_id}")
}

/// A team's news feed.
pub fn team_news_url(sport: &str, league: &str, team_id: &str) -> String {
    format!("{ESPN_BASE}/{sport}/{league}/news?team={team_id}&limit=16")
}

/// A league's full standings — a different host (`apis/v2`) from the scoreboard.
pub fn standings_url(sport: &str, league: &str) -> String {
    format!("https://site.api.espn.com/apis/v2/sports/{sport}/{league}/standings")
}

/// A league's season leaders — the core API, whose entries are `$ref` links.
pub fn leaders_url(sport: &str, league: &str, year: i32) -> String {
    format!(
        "https://sports.core.api.espn.com/v2/sports/{sport}/leagues/{league}/seasons/{year}/types/2/leaders"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Datelike;

    fn at(s: &str) -> chrono::DateTime<chrono::Utc> {
        chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%SZ")
            .expect("fixture parses")
            .and_utc()
    }

    /// Turn a `scoreboard_days` list back into its first/last dates.
    fn bounds(days: &[String]) -> (chrono::NaiveDate, chrono::NaiveDate) {
        let p = |s: &str| chrono::NaiveDate::parse_from_str(s, "%Y%m%d").expect("day parses");
        (
            p(days.first().expect("at least one day")),
            p(days.last().expect("at least one day")),
        )
    }

    #[test]
    fn enumerates_each_day_in_the_span() {
        let days = scoreboard_days(at("2026-08-10T14:33:00Z"), 24.0);
        assert_eq!(
            days,
            vec!["20260808", "20260809", "20260810", "20260811", "20260812",]
        );
    }

    /// Count check: span is `1 + ceil(window_hours/24)` days each side of
    /// `now`, inclusive on both ends, so the list is `2*span + 1` long.
    #[test]
    fn day_count_matches_the_derived_span() {
        for window in [6.0, 24.0, 48.0, 72.0] {
            let span_days = 1 + (window / 24.0f64).ceil() as i64;
            let days = scoreboard_days(at("2026-08-10T14:33:00Z"), window);
            assert_eq!(
                days.len() as i64,
                2 * span_days + 1,
                "window {window}: expected {} days, got {}",
                2 * span_days + 1,
                days.len()
            );
        }
    }

    /// Every entry must be a distinct, consecutive day — no gaps or repeats.
    #[test]
    fn days_are_consecutive_and_unique() {
        let days = scoreboard_days(at("2026-08-10T14:33:00Z"), 48.0);
        let parsed: Vec<chrono::NaiveDate> = days
            .iter()
            .map(|d| chrono::NaiveDate::parse_from_str(d, "%Y%m%d").unwrap())
            .collect();
        for pair in parsed.windows(2) {
            assert_eq!(pair[1] - pair[0], chrono::Duration::days(1));
        }
    }

    /// A window that reaches back into the prior year has to keep crossing
    /// the year boundary correctly (no wraparound within a single year, no
    /// duplicate/garbled dates).
    #[test]
    fn crosses_a_year_boundary_cleanly() {
        let days = scoreboard_days(at("2026-01-01T12:00:00Z"), 72.0);
        assert!(days.contains(&"20251229".to_string()));
        assert!(days.contains(&"20260101".to_string()));
        assert!(days.contains(&"20260105".to_string()));
        let (start, end) = bounds(&days);
        assert_eq!(start.year(), 2025);
        assert_eq!(end.year(), 2026);
    }

    /// A window that reaches back into the prior month (but same year) has to
    /// cross that boundary correctly too.
    #[test]
    fn crosses_a_month_boundary_cleanly() {
        let days = scoreboard_days(at("2026-03-01T12:00:00Z"), 48.0);
        assert!(days.contains(&"20260228".to_string()));
        assert!(days.contains(&"20260301".to_string()));
    }

    /// The property that actually matters, and the one the bug violated: every
    /// game `transform_scoreboard` would keep has to be covered by *some* day
    /// in the list. It keeps finals up to `window_hours` behind and starts up
    /// to `window_hours` ahead, so both edges must fall inside the span.
    #[test]
    fn covers_every_game_the_window_filter_would_keep() {
        for window in [6.0, 24.0, 48.0, 72.0] {
            let now = at("2026-08-10T14:33:00Z");
            let (start, end) = bounds(&scoreboard_days(now, window));
            let earliest = (now - chrono::Duration::minutes((window * 60.0) as i64)).date_naive();
            let latest = (now + chrono::Duration::minutes((window * 60.0) as i64)).date_naive();
            assert!(
                start <= earliest,
                "window {window}: {start} must reach back to {earliest}"
            );
            assert!(
                end >= latest,
                "window {window}: {end} must reach forward to {latest}"
            );
        }
    }

    /// A 7:10pm Pacific game sits on ESPN's 10th slate but timestamps as the
    /// 11th in UTC. Computing the span from a UTC instant therefore has to
    /// carry slack, or an evening request loses that night's own game — the
    /// exact failure that made this worth fixing carefully.
    #[test]
    fn pads_beyond_the_window_for_espn_game_day_offset() {
        let now = at("2026-08-11T02:10:00Z"); // 7:10pm Pacific on the 10th
        let (start, end) = bounds(&scoreboard_days(now, 24.0));
        let slate = chrono::NaiveDate::from_ymd_opt(2026, 8, 10).unwrap();
        assert!(
            start < slate && slate < end,
            "the 10th's slate must sit inside {start}..{end}"
        );
        // Slack on both sides, not just whatever the window rounds to.
        assert!(start <= chrono::NaiveDate::from_ymd_opt(2026, 8, 9).unwrap());
        assert!(end >= chrono::NaiveDate::from_ymd_opt(2026, 8, 12).unwrap());
    }

    #[test]
    fn a_wider_window_asks_for_a_wider_span() {
        let now = at("2026-08-10T14:33:00Z");
        let (narrow_start, narrow_end) = bounds(&scoreboard_days(now, 24.0));
        let (wide_start, wide_end) = bounds(&scoreboard_days(now, 96.0));
        assert!(wide_start < narrow_start);
        assert!(wide_end > narrow_end);
    }

    #[test]
    fn merges_events_from_multiple_days_and_preserves_other_fields() {
        let day1 = serde_json::json!({
            "leagues": [{"id": "10", "name": "American League"}],
            "season": {"year": 2026},
            "events": [
                {"id": "401", "name": "Game 401"},
                {"id": "402", "name": "Game 402"},
            ],
        });
        let day2 = serde_json::json!({
            "leagues": [{"id": "10", "name": "American League"}],
            "season": {"year": 2026},
            // "402" also shows up on the next day's slate (ESPN game-day
            // numbering overlap) and must not be duplicated.
            "events": [
                {"id": "402", "name": "Game 402"},
                {"id": "403", "name": "Game 403"},
            ],
        });

        let merged = merge_scoreboards(&[day1, day2]);

        let events = merged["events"].as_array().expect("events array");
        let ids: Vec<&str> = events.iter().map(|e| e["id"].as_str().unwrap()).collect();
        assert_eq!(ids, vec!["401", "402", "403"]);
        assert_eq!(merged["leagues"][0]["name"], "American League");
        assert_eq!(merged["season"]["year"], 2026);
    }

    #[test]
    fn merge_of_a_single_day_is_unchanged() {
        let day = serde_json::json!({
            "leagues": [{"id": "10"}],
            "events": [{"id": "1"}],
        });
        let merged = merge_scoreboards(std::slice::from_ref(&day));
        assert_eq!(merged, day);
    }
}

// ─── Season ranking ──────────────────────────────────────────────────────

/// Where a season type sits in the priority order that decides which leagues
/// lead. Lower is higher priority: a regular season outranks a preseason, so a
/// league mid-season is never buried under one only in exhibition play. An
/// unknown type sorts last, above nothing.
pub fn season_rank(season_type: &str) -> u8 {
    match season_type {
        "Regular Season" => 0,
        "Postseason" => 1,
        "Preseason" => 2,
        // off-season / unknown
        _ => 3,
    }
}

/// Whether a league's season is currently underway on `today`. Off-season /
/// not-yet-started leagues (ESPN may still label them "Regular Season") are
/// deprioritised so the track slots go to sports actually being played.
/// Missing dates default to active — never demote a league for absent data.
pub(super) fn season_underway(season: &SeasonInfo, today: chrono::NaiveDate) -> bool {
    let after_start = season.start.is_none_or(|s| today >= s);
    let before_end = season.end.is_none_or(|e| today <= e);
    after_start && before_end
}

/// The masthead's season-clock detail for one league, from its `season` block.
///
/// - before the season opens → "N days out" (the countdown)
/// - preseason → "preseason" (plus the week, when the feed carries one)
/// - regular season with a week (football) → "week N of M"
/// - regular season without one (baseball, basketball) → "N days left"
/// - anything else → the season type, lowercased
///
/// `now`, `start`, `end` are dates; `week` is the current week number when the
/// feed reports one (football only), and `total_weeks` the calendar length.
pub fn clock_detail(
    season_type: &str,
    now: chrono::NaiveDate,
    start: Option<chrono::NaiveDate>,
    end: Option<chrono::NaiveDate>,
    week: Option<i64>,
    total_weeks: Option<usize>,
) -> String {
    if let Some(start) = start
        && now < start
    {
        let days = (start - now).num_days();
        return format!("{days} days out");
    }
    match season_type {
        "Preseason" => match week {
            Some(w) => format!("preseason wk {w}"),
            None => "preseason".to_string(),
        },
        "Regular Season" => match (week, total_weeks) {
            (Some(w), Some(total)) => format!("week {w} of {total}"),
            _ => match end {
                Some(end) if end >= now => format!("{} days left", (end - now).num_days()),
                _ => "regular season".to_string(),
            },
        },
        other => other.to_lowercase(),
    }
}

// ─── Season block (from the scoreboard) ──────────────────────────────────

pub struct SeasonInfo {
    pub season_type: String,
    pub start: Option<chrono::NaiveDate>,
    pub end: Option<chrono::NaiveDate>,
    pub week: Option<i64>,
    pub total_weeks: Option<usize>,
    pub year: i32,
}

fn parse_date(v: Option<&serde_json::Value>) -> Option<chrono::NaiveDate> {
    v.and_then(|d| d.as_str())
        .map(|s| &s[..s.len().min(10)])
        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
}

/// The season block every scoreboard carries — the source for both the ranking
/// (via `season.type.name`) and the masthead clock.
pub fn parse_season(scoreboard: &serde_json::Value) -> SeasonInfo {
    let league = scoreboard
        .get("leagues")
        .and_then(|l| l.as_array())
        .and_then(|arr| arr.first());
    let season = league.and_then(|l| l.get("season"));
    let season_type = season
        .and_then(|s| s.get("type"))
        .and_then(|t| t.get("name"))
        .and_then(|n| n.as_str())
        .unwrap_or("")
        .to_string();
    SeasonInfo {
        season_type,
        start: parse_date(season.and_then(|s| s.get("startDate"))),
        end: parse_date(season.and_then(|s| s.get("endDate"))),
        week: scoreboard
            .get("week")
            .and_then(|w| w.get("number"))
            .and_then(|n| n.as_i64()),
        total_weeks: league
            .and_then(|l| l.get("calendar"))
            .and_then(|c| c.as_array())
            .map(|a| a.len()),
        year: season
            .and_then(|s| s.get("year"))
            .and_then(|y| y.as_i64())
            .unwrap_or(0) as i32,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn date(s: &str) -> chrono::NaiveDate {
        chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn regular_season_outranks_preseason_and_offseason() {
        assert!(season_rank("Regular Season") < season_rank("Preseason"));
        assert!(season_rank("Preseason") < season_rank("off-season nonsense"));
        assert!(season_rank("Regular Season") < season_rank("Postseason"));
    }

    fn season_info(start: Option<&str>, end: Option<&str>) -> SeasonInfo {
        SeasonInfo {
            season_type: "Regular Season".to_string(),
            start: start.map(date),
            end: end.map(date),
            week: None,
            total_weeks: None,
            year: 2026,
        }
    }

    #[test]
    fn season_underway_is_false_before_the_start_date() {
        let s = season_info(Some("2026-10-01"), Some("2027-04-01"));
        assert!(!season_underway(&s, date("2026-09-21")));
    }

    #[test]
    fn season_underway_is_true_within_the_season_window() {
        let s = season_info(Some("2026-03-28"), Some("2026-10-01"));
        assert!(season_underway(&s, date("2026-08-17")));
    }

    #[test]
    fn season_underway_is_false_after_the_end_date() {
        let s = season_info(Some("2026-03-28"), Some("2026-10-01"));
        assert!(!season_underway(&s, date("2026-11-01")));
    }

    #[test]
    fn season_underway_defaults_to_true_with_no_dates() {
        let s = season_info(None, None);
        assert!(season_underway(&s, date("2026-09-21")));
    }

    #[test]
    fn season_underway_is_true_with_only_a_past_start_date() {
        let s = season_info(Some("2026-03-28"), None);
        assert!(season_underway(&s, date("2026-09-21")));
    }

    #[test]
    fn season_underway_is_true_with_only_a_future_end_date() {
        let s = season_info(None, Some("2027-04-01"));
        assert!(season_underway(&s, date("2026-09-21")));
    }

    #[test]
    fn clock_counts_down_before_the_season_opens() {
        // NBA on 2026-08-17, opening 2026-09-30.
        let d = clock_detail(
            "Regular Season",
            date("2026-08-17"),
            Some(date("2026-09-30")),
            Some(date("2027-06-26")),
            None,
            None,
        );
        assert_eq!(d, "44 days out");
    }

    #[test]
    fn clock_shows_the_week_for_a_league_that_reports_one() {
        let d = clock_detail(
            "Regular Season",
            date("2026-10-01"),
            Some(date("2026-09-01")),
            Some(date("2027-02-01")),
            Some(3),
            Some(18),
        );
        assert_eq!(d, "week 3 of 18");
    }

    #[test]
    fn clock_falls_back_to_days_left_without_a_week() {
        // MLB mid-season, no week concept.
        let d = clock_detail(
            "Regular Season",
            date("2026-08-17"),
            Some(date("2026-02-19")),
            Some(date("2026-11-12")),
            None,
            None,
        );
        assert_eq!(d, "87 days left");
    }

    #[test]
    fn clock_names_preseason_with_its_week() {
        let d = clock_detail(
            "Preseason",
            date("2026-08-17"),
            Some(date("2026-08-06")),
            Some(date("2027-02-16")),
            Some(2),
            None,
        );
        assert_eq!(d, "preseason wk 2");
    }
}

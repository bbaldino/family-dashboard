/// Whether a league's season is currently underway on `today`. ESPN may still
/// label an off-season or not-yet-started league "Regular Season"; its dates
/// are what tell `phase_for` the league is dormant. Missing dates default to
/// active — never demote a league for absent data.
pub(super) fn season_underway(season: &SeasonInfo, today: chrono::NaiveDate) -> bool {
    let after_start = season.start.is_none_or(|s| today >= s);
    let before_end = season.end.is_none_or(|e| today <= e);
    after_start && before_end
}

/// The season-clock detail for a regular-season or preseason league, from its
/// `season` block (`clock_for` handles the postseason and off-season).
///
/// - before the season opens → "N days out" (the countdown)
/// - preseason → "preseason" (plus the week, when the feed carries one)
/// - regular season with a week (football) → "week N of M"
/// - regular season without one (baseball, basketball) → a countdown to the
///   postseason: "postseason in N days", "postseason tomorrow"; plain
///   "regular season" when the post window is unknown
/// - anything else → the season type, lowercased
///
/// `now`, `start` are dates; `post_start` is the postseason window's first
/// day (from the core API — the scoreboard's own `season.endDate` is the end
/// of the whole year, postseason included, so it can't say when the regular
/// season stops). `week` is the current week number when the feed reports one
/// (football only), and `total_weeks` the current season type's own week
/// count (its calendar entry's length, not the calendar's).
pub fn clock_detail(
    season_type: &str,
    now: chrono::NaiveDate,
    start: Option<chrono::NaiveDate>,
    post_start: Option<chrono::NaiveDate>,
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
            _ => match post_start.map(|p| (p - now).num_days()) {
                Some(1) => "postseason tomorrow".to_string(),
                Some(days) if days > 1 => format!("postseason in {days} days"),
                _ => "regular season".to_string(),
            },
        },
        other => other.to_lowercase(),
    }
}

/// Where a league is in its year. Decides a column's shape, and — by
/// declaration order, which `Ord` follows — the page's column order.
#[derive(serde::Serialize, Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    Postseason,
    Regular,
    Preseason,
    Offseason,
}

/// The postseason's `[start, end)` dates from the core API's season-type
/// document (`…/seasons/{year}/types/3`).
pub fn parse_post_window(v: &serde_json::Value) -> Option<(chrono::NaiveDate, chrono::NaiveDate)> {
    Some((
        parse_date(v.get("startDate"))?,
        parse_date(v.get("endDate"))?,
    ))
}

/// The league's phase on `today`. The postseason window wins outright: MLB's
/// scoreboard keeps reporting "Regular Season" through its whole postseason.
/// The window's end is exclusive — on or after it, the league is done for the
/// year. A "Regular Season" whose dates don't cover today is a dormant league.
pub fn phase_for(
    season: &SeasonInfo,
    post_window: Option<(chrono::NaiveDate, chrono::NaiveDate)>,
    today: chrono::NaiveDate,
) -> Phase {
    if let Some((start, end)) = post_window
        && today >= start
        && today < end
    {
        return Phase::Postseason;
    }
    if let Some((_, end)) = post_window
        && today >= end
    {
        return Phase::Offseason;
    }
    match season.season_type.as_str() {
        "Preseason" => Phase::Preseason,
        "Regular Season" if season_underway(season, today) => Phase::Regular,
        _ => Phase::Offseason,
    }
}

/// The small right-hand phase label on a column's card kicker.
pub fn phase_detail(phase: Phase, season: &SeasonInfo, today: chrono::NaiveDate) -> String {
    match phase {
        Phase::Postseason => "Postseason".to_string(),
        Phase::Regular => match season.week {
            Some(w) => format!("Week {w}"),
            None => "Regular season".to_string(),
        },
        Phase::Preseason => "Preseason".to_string(),
        Phase::Offseason => match season.start {
            Some(start) if start > today => format!("Season opens {}", start.format("%b %-d")),
            _ => "Off-season".to_string(),
        },
    }
}

/// The masthead's season-clock detail for one league, saying the same phase
/// its column shows. ESPN keeps labelling a finished league "Regular Season",
/// so the off-season and postseason read from the phase, not the season type:
/// off-season counts down to an announced opener, else reads "off-season".
/// A regular season counts down to `post_window`'s start (see `clock_detail`).
pub fn clock_for(
    phase: Phase,
    season: &SeasonInfo,
    post_window: Option<(chrono::NaiveDate, chrono::NaiveDate)>,
    today: chrono::NaiveDate,
) -> String {
    match phase {
        Phase::Postseason => "postseason".to_string(),
        Phase::Offseason => match season.start {
            Some(start) if start > today => format!("{} days out", (start - today).num_days()),
            _ => "off-season".to_string(),
        },
        Phase::Regular | Phase::Preseason => clock_detail(
            &season.season_type,
            today,
            season.start,
            post_window.map(|(start, _)| start),
            season.week,
            season.total_weeks,
        ),
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

/// A season type's name, by its id rather than the league's own wording:
/// MLB calls type 1 "Spring Training", the NFL "Preseason", and the phase and
/// clock match on the name. Ids 1–3 (or the `pre`/`reg`/`post` abbreviation)
/// map to "Preseason", "Regular Season" and "Postseason"; anything else keeps
/// ESPN's name.
fn canonical_season_type(t: &serde_json::Value) -> String {
    let id = t.get("type").and_then(|n| n.as_i64()).or_else(|| {
        t.get("id")
            .and_then(super::super::transform::json_id)?
            .parse()
            .ok()
    });
    match (id, t.get("abbreviation").and_then(|a| a.as_str())) {
        (Some(1), _) | (None, Some("pre")) => "Preseason".to_string(),
        (Some(2), _) | (None, Some("reg")) => "Regular Season".to_string(),
        (Some(3), _) | (None, Some("post")) => "Postseason".to_string(),
        _ => t
            .get("name")
            .and_then(|n| n.as_str())
            .unwrap_or("")
            .to_string(),
    }
}

/// The season block every scoreboard carries — the source for both the
/// column's phase (via `season.type`, see `canonical_season_type`, and its
/// dates) and the masthead
/// clock.
pub fn parse_season(scoreboard: &serde_json::Value) -> SeasonInfo {
    let league = scoreboard
        .get("leagues")
        .and_then(|l| l.as_array())
        .and_then(|arr| arr.first());
    let season = league.and_then(|l| l.get("season"));
    let season_type = season
        .and_then(|s| s.get("type"))
        .map(canonical_season_type)
        .unwrap_or_default();
    // The calendar has one entry per season type (Preseason, Regular
    // Season, Postseason, Off Season), each listing its own weeks. The
    // count wanted is the current type's weeks — the calendar's own length
    // is the number of season types, which is how "week 3 of 4" happened.
    // Baseball and basketball calendars are bare date strings, so no entry
    // matches and the count stays `None`.
    let total_weeks = league
        .and_then(|l| l.get("calendar"))
        .and_then(|c| c.as_array())
        .and_then(|cal| {
            cal.iter()
                .find(|e| e.get("label").and_then(|l| l.as_str()) == Some(season_type.as_str()))
        })
        .and_then(|e| e.get("entries"))
        .and_then(|e| e.as_array())
        .map(|a| a.len());
    SeasonInfo {
        season_type,
        start: parse_date(season.and_then(|s| s.get("startDate"))),
        end: parse_date(season.and_then(|s| s.get("endDate"))),
        week: scoreboard
            .get("week")
            .and_then(|w| w.get("number"))
            .and_then(|n| n.as_i64()),
        total_weeks,
        year: season
            .and_then(|s| s.get("year"))
            .and_then(|y| y.as_i64())
            .unwrap_or(0) as i32,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NFL_CALENDAR: &str =
        include_str!("../../../../tests/fixtures/section/nfl_scoreboard_calendar.json");

    const MLB_POST_TYPE: &str =
        include_str!("../../../../tests/fixtures/section/mlb_2026_postseason_type.json");

    fn date(s: &str) -> chrono::NaiveDate {
        chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    fn season(kind: &str, start: &str, end: &str, week: Option<i64>) -> SeasonInfo {
        SeasonInfo {
            season_type: kind.to_string(),
            start: Some(date(start)),
            end: Some(date(end)),
            week,
            total_weeks: None,
            year: 2026,
        }
    }

    /// ESPN's NFL calendar has one entry per season type (preseason, regular,
    /// postseason, off-season); the week count is the regular season's own
    /// entries (18), not the calendar's length (4) — the "week 3 of 4" bug.
    #[test]
    fn total_weeks_counts_the_current_season_types_own_entries() {
        let sb: serde_json::Value = serde_json::from_str(NFL_CALENDAR).unwrap();
        let s = parse_season(&sb);
        assert_eq!(s.season_type, "Regular Season");
        assert_eq!(s.week, Some(3));
        assert_eq!(s.total_weeks, Some(18));
    }

    /// Baseball's calendar is a bare list of dates — no week concept at all.
    #[test]
    fn total_weeks_is_none_for_a_day_calendar() {
        let sb = serde_json::json!({ "leagues": [{
            "season": { "type": { "name": "Regular Season" } },
            "calendar": ["2026-02-19T08:00Z", "2026-07-13T07:00Z"],
        }] });
        assert_eq!(parse_season(&sb).total_weeks, None);
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
            Some(date("2027-04-18")),
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
            Some(date("2027-01-09")),
            Some(3),
            Some(18),
        );
        assert_eq!(d, "week 3 of 18");
    }

    /// The scoreboard's `season.endDate` is the end of the whole year —
    /// postseason included (MLB 2026: Nov 12, the post window's own end) —
    /// so counting to it read "45 days left" the day after MLB's regular
    /// season ended. A day-calendar league counts to its postseason instead.
    #[test]
    fn clock_counts_down_to_the_postseason_without_a_week() {
        // MLB mid-season, no week concept; postseason opens Sep 29.
        let post_start = Some(date("2026-09-29"));
        let d = clock_detail(
            "Regular Season",
            date("2026-08-17"),
            Some(date("2026-02-19")),
            post_start,
            None,
            None,
        );
        assert_eq!(d, "postseason in 43 days");
    }

    /// Today's shape (2026-09-28): the regular season finished yesterday,
    /// the post window opens tomorrow, the scoreboard still says "Regular
    /// Season" with a Nov 12 end date.
    #[test]
    fn clock_on_the_eve_of_the_postseason_says_tomorrow() {
        let today = date("2026-09-28");
        let mlb = season("Regular Season", "2026-02-19", "2026-11-12", None);
        let window = Some((date("2026-09-29"), date("2026-11-12")));
        let phase = phase_for(&mlb, window, today);
        assert_eq!(phase, Phase::Regular);
        assert_eq!(clock_for(phase, &mlb, window, today), "postseason tomorrow");
    }

    /// Without the post window there's nothing honest to count to — the
    /// scoreboard's end date is the year's, not the regular season's.
    #[test]
    fn clock_without_a_post_window_names_the_regular_season() {
        let mlb = season("Regular Season", "2026-02-19", "2026-11-12", None);
        assert_eq!(
            clock_for(Phase::Regular, &mlb, None, date("2026-08-17")),
            "regular season"
        );
    }

    #[test]
    fn clock_names_preseason_with_its_week() {
        let d = clock_detail(
            "Preseason",
            date("2026-08-17"),
            Some(date("2026-08-06")),
            Some(date("2027-01-09")),
            Some(2),
            None,
        );
        assert_eq!(d, "preseason wk 2");
    }

    #[test]
    fn post_window_parses_the_core_api_season_type() {
        let v: serde_json::Value = serde_json::from_str(MLB_POST_TYPE).unwrap();
        assert_eq!(
            parse_post_window(&v),
            Some((date("2026-09-29"), date("2026-11-12")))
        );
    }

    /// MLB's scoreboard still says "Regular Season" during the postseason;
    /// the postseason window is what decides.
    #[test]
    fn a_date_inside_the_post_window_is_postseason_whatever_the_scoreboard_says() {
        let s = season("Regular Season", "2026-02-19", "2026-11-12", None);
        let w = Some((date("2026-09-29"), date("2026-11-12")));
        assert_eq!(phase_for(&s, w, date("2026-10-03")), Phase::Postseason);
        assert_eq!(phase_for(&s, w, date("2026-09-28")), Phase::Regular);
        assert_eq!(phase_for(&s, w, date("2026-11-12")), Phase::Offseason);
    }

    /// MLB names season type 1 "Spring Training", not "Preseason": the type's
    /// id is what says preseason, whatever the league calls it.
    #[test]
    fn spring_training_is_the_preseason() {
        let sb = serde_json::json!({ "leagues": [{ "season": {
            "year": 2026,
            "startDate": "2026-02-19T08:00Z",
            "endDate": "2026-11-12T07:59Z",
            "type": { "id": "1", "type": 1, "name": "Spring Training", "abbreviation": "pre" },
        } }] });
        let s = parse_season(&sb);
        let today = date("2026-03-10");
        assert_eq!(phase_for(&s, None, today), Phase::Preseason);
        assert_eq!(clock_for(Phase::Preseason, &s, None, today), "preseason");
    }

    #[test]
    fn preseason_and_dormant_seasons_classify() {
        let pre = season("Preseason", "2026-08-01", "2027-02-15", Some(2));
        assert_eq!(phase_for(&pre, None, date("2026-08-17")), Phase::Preseason);
        // ESPN keeps labelling a finished league "Regular Season".
        let done = season("Regular Season", "2025-10-21", "2026-06-20", None);
        assert_eq!(phase_for(&done, None, date("2026-09-28")), Phase::Offseason);
    }

    #[test]
    fn phases_order_postseason_first() {
        let mut v = vec![
            Phase::Offseason,
            Phase::Regular,
            Phase::Preseason,
            Phase::Postseason,
        ];
        v.sort();
        assert_eq!(
            v,
            [
                Phase::Postseason,
                Phase::Regular,
                Phase::Preseason,
                Phase::Offseason
            ]
        );
    }

    /// The masthead clock says the same phase the column shows: a finished
    /// league ESPN still labels "Regular Season" reads off-season, not
    /// "regular season".
    #[test]
    fn clock_for_follows_the_phase() {
        let today = date("2026-11-20");
        let mlb = season("Regular Season", "2026-02-19", "2026-11-12", None);
        let window = Some((date("2026-09-29"), date("2026-11-12")));
        let phase = phase_for(&mlb, window, today);
        assert_eq!(phase, Phase::Offseason);
        assert_eq!(clock_for(phase, &mlb, window, today), "off-season");

        let nba = season("Regular Season", "2026-10-21", "2027-06-20", None);
        assert_eq!(
            clock_for(Phase::Offseason, &nba, None, date("2026-09-28")),
            "23 days out"
        );
        assert_eq!(
            clock_for(Phase::Postseason, &mlb, window, date("2026-10-03")),
            "postseason"
        );
        let nfl = SeasonInfo {
            total_weeks: Some(18),
            ..season("Regular Season", "2026-09-01", "2027-02-15", Some(4))
        };
        assert_eq!(
            clock_for(Phase::Regular, &nfl, None, date("2026-09-28")),
            "week 4 of 18"
        );
        let pre = season("Preseason", "2026-08-01", "2027-02-15", Some(2));
        assert_eq!(
            clock_for(Phase::Preseason, &pre, None, date("2026-08-17")),
            "preseason wk 2"
        );
    }

    #[test]
    fn phase_detail_reads_per_phase() {
        let nfl = season("Regular Season", "2026-09-01", "2027-02-15", Some(3));
        assert_eq!(
            phase_detail(Phase::Regular, &nfl, date("2026-09-28")),
            "Week 3"
        );
        let mlb = season("Regular Season", "2026-02-19", "2026-11-12", None);
        assert_eq!(
            phase_detail(Phase::Regular, &mlb, date("2026-08-01")),
            "Regular season"
        );
        assert_eq!(
            phase_detail(Phase::Postseason, &mlb, date("2026-10-03")),
            "Postseason"
        );
        let nba = season("Regular Season", "2026-10-21", "2027-06-20", None);
        assert_eq!(
            phase_detail(Phase::Offseason, &nba, date("2026-09-28")),
            "Season opens Oct 21"
        );
        let over = season("Regular Season", "2025-10-21", "2026-06-20", None);
        assert_eq!(
            phase_detail(Phase::Offseason, &over, date("2026-09-28")),
            "Off-season"
        );
    }
}

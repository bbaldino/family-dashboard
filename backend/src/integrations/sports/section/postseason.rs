//! The postseason view: every series in the league, built from per-day
//! scoreboards (ESPN 400s on date ranges, so days are fetched singly).
//!
//! ESPN gives each game a round note ("NLDS - Game 2"), per-series wins and
//! best-of on the competition's `series`, and schedules later rounds against
//! placeholder opponents with negative ids ("-2", "Yankees/Red Sox"). It does
//! not give the bracket tree, so this is a round-by-round list, not a bracket.

use chrono::{DateTime, NaiveDate, Utc};
use serde::Serialize;

use super::super::transform::{json_id, parse_espn_timestamp};

#[derive(Serialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct PostseasonView {
    pub current: Vec<PostseasonRound>,
    pub completed: Vec<CompletedRound>,
    pub upcoming: Vec<UpcomingRound>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PostseasonRound {
    pub round: String,
    pub best_of: Option<u32>,
    pub series: Vec<SeriesRow>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SeriesRow {
    pub a: String,
    pub a_wins: u32,
    pub b: String,
    pub b_wins: u32,
    pub detail: String,
    pub live: bool,
    pub done: bool,
    pub mine: bool,
    pub next_starts_at: Option<String>,
}

#[derive(Serialize, Debug)]
pub struct CompletedRound {
    pub round: String,
    pub summary: String,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UpcomingRound {
    pub round: String,
    pub best_of: Option<u32>,
    pub starts_at: String,
}

#[derive(Debug, PartialEq, Eq)]
pub enum TeamPostStatus {
    /// Still playing (or waiting on its next round): the card's series status.
    Alive(String),
    /// Out, or champion: the card's "season ended" line.
    Ended(String),
    /// The field is set and the team isn't in it.
    Missed,
    /// No postseason games known yet.
    Unknown,
}

pub fn round_of(headline: &str) -> (String, Option<u32>) {
    match headline.split_once(" - Game ") {
        Some((round, game)) => (round.trim().to_string(), game.trim().parse().ok()),
        None => (headline.trim().to_string(), None),
    }
}

/// How far past today to fetch scheduled postseason days. Three weeks is enough
/// for "still to come" to show the next round (e.g. the LCS during the wild card
/// round), at one extra scoreboard request per day on the first load.
pub const POSTSEASON_LOOKAHEAD_DAYS: i64 = 21;

/// `YYYYMMDD` for every day from the postseason's start through `ahead` days
/// past today.
pub fn postseason_days(start: NaiveDate, today: NaiveDate, ahead: i64) -> Vec<String> {
    let end = today + chrono::Duration::days(ahead);
    super::super::espn::day_range(start, end)
}

struct Side {
    /// Real team id, or the placeholder's name ("Yankees/Red Sox") — ESPN
    /// gives every placeholder the same id, so the name keys it.
    key: String,
    id: String,
    abbr: String,
    placeholder: bool,
    winner: bool,
}

struct PostEvent {
    id: String,
    round: String,
    game: Option<u32>,
    start: Option<DateTime<Utc>>,
    starts_at: String,
    state: String,
    short_detail: String,
    sides: [Side; 2],
    wins: Option<Vec<(String, u32)>>,
    completed: Option<bool>,
    best_of: Option<u32>,
    summary: Option<String>,
}

fn parse_event(e: &serde_json::Value) -> Option<PostEvent> {
    if e["season"]["type"].as_i64() != Some(3) {
        return None;
    }
    let comp = &e["competitions"][0];
    let (round, game) = round_of(comp["notes"][0]["headline"].as_str()?);
    let cs = comp["competitors"].as_array()?;
    if cs.len() != 2 {
        return None;
    }
    let side = |c: &serde_json::Value| {
        let id = json_id(&c["id"]).unwrap_or_default();
        let abbr = c["team"]["abbreviation"].as_str().unwrap_or("").to_string();
        let placeholder = id.starts_with('-') || id.is_empty();
        Side {
            key: if placeholder {
                abbr.clone()
            } else {
                id.clone()
            },
            id,
            abbr,
            placeholder,
            winner: c["winner"].as_bool().unwrap_or(false),
        }
    };
    let series = comp.get("series").filter(|s| !s.is_null());
    let starts_at = e["date"].as_str().unwrap_or("").to_string();
    Some(PostEvent {
        id: json_id(&e["id"]).unwrap_or_default(),
        round,
        game,
        start: parse_espn_timestamp(&starts_at),
        starts_at,
        state: e["status"]["type"]["state"]
            .as_str()
            .unwrap_or("")
            .to_string(),
        short_detail: e["status"]["type"]["shortDetail"]
            .as_str()
            .unwrap_or("")
            .to_string(),
        sides: [side(&cs[0]), side(&cs[1])],
        wins: series.and_then(|s| s["competitors"].as_array()).map(|cs| {
            cs.iter()
                .filter_map(|c| Some((json_id(&c["id"])?, c["wins"].as_u64()? as u32)))
                .collect()
        }),
        completed: series.and_then(|s| s["completed"].as_bool()),
        best_of: series
            .and_then(|s| s["totalCompetitions"].as_u64())
            .map(|n| n as u32),
        summary: series.and_then(|s| s["summary"].as_str()).map(String::from),
    })
}

/// One series' events, date order.
struct Series<'a> {
    events: Vec<&'a PostEvent>,
}

impl Series<'_> {
    fn first(&self) -> &PostEvent {
        self.events[0]
    }
    fn placeholder(&self) -> bool {
        self.first().sides.iter().any(|s| s.placeholder)
    }
    fn latest_with_series(&self) -> Option<&PostEvent> {
        self.events.iter().rev().find(|e| e.wins.is_some()).copied()
    }
    /// Wins in the first event's side order.
    fn wins(&self) -> (u32, u32) {
        let [s0, s1] = &self.first().sides;
        if let Some(w) = self.latest_with_series().and_then(|e| e.wins.as_ref()) {
            let of = |id: &str| {
                w.iter()
                    .find(|(i, _)| i == id)
                    .map(|(_, n)| *n)
                    .unwrap_or(0)
            };
            return (of(&s0.id), of(&s1.id));
        }
        // No series block (single-game rounds): count finished games' winners.
        let won = |key: &str| {
            self.events
                .iter()
                .filter(|e| e.state == "post")
                .filter(|e| e.sides.iter().any(|s| s.key == key && s.winner))
                .count() as u32
        };
        (won(&s0.key), won(&s1.key))
    }
    fn best_of(&self) -> Option<u32> {
        self.events.iter().find_map(|e| e.best_of)
    }
    fn done(&self) -> bool {
        match self.latest_with_series().and_then(|e| e.completed) {
            Some(c) => c,
            None => !self.events.is_empty() && self.events.iter().all(|e| e.state == "post"),
        }
    }
    fn has(&self, team_id: &str) -> bool {
        self.first().sides.iter().any(|s| s.id == team_id)
    }
}

fn series_key(e: &PostEvent) -> (String, String, String) {
    let (a, b) = (&e.sides[0].key, &e.sides[1].key);
    let (lo, hi) = if a <= b { (a, b) } else { (b, a) };
    (e.round.clone(), lo.clone(), hi.clone())
}

fn row(series: &Series, team_id: &str, now: DateTime<Utc>) -> SeriesRow {
    let [s0, s1] = &series.first().sides;
    let (w0, w1) = series.wins();
    // The leader reads first; a tie keeps ESPN's order.
    let (a, aw, b, bw) = if w1 > w0 {
        (&s1.abbr, w1, &s0.abbr, w0)
    } else {
        (&s0.abbr, w0, &s1.abbr, w1)
    };
    let live = series.events.iter().find(|e| e.state == "in");
    let next = series
        .events
        .iter()
        .find(|e| e.state == "pre" && e.start.is_none_or(|s| s >= now));
    let done = series.done();
    let detail = if let Some(e) = live {
        e.short_detail.clone()
    } else if done {
        "Final".to_string()
    } else if let Some(e) = next {
        e.game
            .map(|g| format!("G{g}"))
            .unwrap_or_else(|| "Next".to_string())
    } else {
        series
            .latest_with_series()
            .and_then(|e| e.summary.clone())
            .unwrap_or_default()
    };
    SeriesRow {
        a: a.clone(),
        a_wins: aw,
        b: b.clone(),
        b_wins: bw,
        detail,
        live: live.is_some(),
        done,
        mine: series.has(team_id),
        next_starts_at: if live.is_none() && !done {
            next.map(|e| e.starts_at.clone())
        } else {
            None
        },
    }
}

/// "LEADER leads 2–1" / "tied 2–2" / "series opens", plus best-of.
fn status_text(round: &str, series: &Series) -> String {
    let [s0, s1] = &series.first().sides;
    let (w0, w1) = series.wins();
    let state = if w0 == 0 && w1 == 0 {
        "series opens".to_string()
    } else if w0 == w1 {
        format!("tied {w0}–{w1}")
    } else if w0 > w1 {
        format!("{} leads {w0}–{w1}", s0.abbr)
    } else {
        format!("{} leads {w1}–{w0}", s1.abbr)
    };
    match series.best_of() {
        Some(n) => format!("{round} · {state} · best of {n}"),
        None => format!("{round} · {state}"),
    }
}

/// The league's postseason as a round-by-round list, and the followed team's
/// place in it.
pub fn build_postseason(
    day_scoreboards: &[serde_json::Value],
    team_id: &str,
    now: DateTime<Utc>,
) -> (PostseasonView, TeamPostStatus) {
    let mut seen = std::collections::HashSet::new();
    let mut events: Vec<PostEvent> = day_scoreboards
        .iter()
        .flat_map(|sb| sb["events"].as_array().into_iter().flatten())
        .filter_map(parse_event)
        .filter(|e| e.id.is_empty() || seen.insert(e.id.clone()))
        .collect();
    events.sort_by_key(|e| e.start);

    // Rounds in order of their first game; series in order of theirs.
    let mut rounds: Vec<(String, Vec<Series>)> = Vec::new();
    let mut keys: Vec<(String, String, String)> = Vec::new();
    let mut series_of: Vec<(usize, usize)> = Vec::new(); // key index → (round, series)
    for e in &events {
        let key = series_key(e);
        if let Some(k) = keys.iter().position(|x| *x == key) {
            let (ri, si) = series_of[k];
            rounds[ri].1[si].events.push(e);
            continue;
        }
        let ri = match rounds.iter().position(|(r, _)| *r == e.round) {
            Some(ri) => ri,
            None => {
                rounds.push((e.round.clone(), Vec::new()));
                rounds.len() - 1
            }
        };
        rounds[ri].1.push(Series { events: vec![e] });
        keys.push(key);
        series_of.push((ri, rounds[ri].1.len() - 1));
    }

    let mut view = PostseasonView::default();
    for (round, series) in &rounds {
        let real: Vec<&Series> = series.iter().filter(|s| !s.placeholder()).collect();
        let best_of = series.iter().find_map(|s| s.best_of());
        if real.is_empty() {
            view.upcoming.push(UpcomingRound {
                round: round.clone(),
                best_of,
                starts_at: series[0].first().starts_at.clone(),
            });
        } else if real.iter().all(|s| s.done()) && real.len() == series.len() {
            let summary = real
                .iter()
                .map(|s| {
                    let [s0, s1] = &s.first().sides;
                    let (w0, w1) = s.wins();
                    let (w, l, ww, lw) = if w0 >= w1 {
                        (s0, s1, w0, w1)
                    } else {
                        (s1, s0, w1, w0)
                    };
                    format!("{} def {} {ww}–{lw}", w.abbr, l.abbr)
                })
                .collect::<Vec<_>>()
                .join(" · ");
            view.completed.push(CompletedRound {
                round: round.clone(),
                summary,
            });
        } else {
            view.current.push(PostseasonRound {
                round: round.clone(),
                best_of,
                series: real.iter().map(|s| row(s, team_id, now)).collect(),
            });
        }
    }

    let status = team_status(
        &rounds,
        team_id,
        !view.current.is_empty() || !view.upcoming.is_empty(),
    );
    (view, status)
}

fn team_status(
    rounds: &[(String, Vec<Series>)],
    team_id: &str,
    more_to_play: bool,
) -> TeamPostStatus {
    let mine: Vec<(&str, &Series)> = rounds
        .iter()
        .flat_map(|(r, ss)| ss.iter().map(move |s| (r.as_str(), s)))
        .filter(|(_, s)| s.has(team_id))
        .collect();
    let real_mine: Vec<&(&str, &Series)> = mine.iter().filter(|(_, s)| !s.placeholder()).collect();

    if let Some((round, s)) = real_mine.iter().find(|(_, s)| !s.done()) {
        return TeamPostStatus::Alive(status_text(round, s));
    }
    if let Some((round, _)) = mine.iter().find(|(_, s)| s.placeholder()) {
        return TeamPostStatus::Alive(format!("{round} next"));
    }
    if let Some((round, s)) = real_mine.last() {
        let [s0, s1] = &s.first().sides;
        let (w0, w1) = s.wins();
        let (_, them, mw, tw) = if s0.id == team_id {
            (s0, s1, w0, w1)
        } else {
            (s1, s0, w1, w0)
        };
        return if mw < tw {
            TeamPostStatus::Ended(format!("Out in {round}, {mw}–{tw} to {}", them.abbr))
        } else if more_to_play {
            TeamPostStatus::Alive(format!("Won the {round} {mw}–{tw}"))
        } else {
            TeamPostStatus::Ended(format!("Won the {round}, {mw}–{tw} over {}", them.abbr))
        };
    }
    if rounds
        .iter()
        .any(|(_, ss)| ss.iter().any(|s| !s.placeholder()))
    {
        TeamPostStatus::Missed
    } else {
        TeamPostStatus::Unknown
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const Y2025: &str =
        include_str!("../../../../tests/fixtures/section/mlb_postseason_2025_wc_ds.json");
    const Y2026: &str =
        include_str!("../../../../tests/fixtures/section/mlb_postseason_2026_opening.json");

    fn boards(json: &str) -> Vec<serde_json::Value> {
        let v: serde_json::Value = serde_json::from_str(json).unwrap();
        v["days"]
            .as_array()
            .unwrap()
            .iter()
            .map(|d| d["scoreboard"].clone())
            .collect()
    }

    fn at(s: &str) -> chrono::DateTime<chrono::Utc> {
        chrono::DateTime::parse_from_rfc3339(s)
            .unwrap()
            .with_timezone(&chrono::Utc)
    }

    fn round<'a>(v: &'a PostseasonView, name: &str) -> &'a PostseasonRound {
        v.current
            .iter()
            .find(|r| r.round == name)
            .unwrap_or_else(|| panic!("no current {name}"))
    }

    #[test]
    fn round_names_and_game_numbers_split_from_the_note() {
        assert_eq!(round_of("NLDS - Game 4"), ("NLDS".to_string(), Some(4)));
        assert_eq!(
            round_of("AFC Divisional Playoffs"),
            ("AFC Divisional Playoffs".to_string(), None)
        );
    }

    #[test]
    fn days_run_from_the_start_through_a_week_ahead() {
        let d = |s: &str| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap();
        let days = postseason_days(d("2026-09-29"), d("2026-10-01"), 7);
        assert_eq!(days.first().map(String::as_str), Some("20260929"));
        assert_eq!(days.last().map(String::as_str), Some("20261008"));
        assert_eq!(days.len(), 10);
    }

    /// 2025, after the Division Series but for one NLDS still at 2–2.
    #[test]
    fn finished_rounds_fold_and_the_running_round_is_current() {
        let (v, _) = build_postseason(&boards(Y2025), "19", at("2025-10-11T12:00:00Z"));
        let done: Vec<&str> = v.completed.iter().map(|r| r.round.as_str()).collect();
        for r in ["ALWC", "NLWC", "ALDS"] {
            assert!(done.contains(&r), "{r} should be completed, got {done:?}");
        }
        let nlwc = v.completed.iter().find(|r| r.round == "NLWC").unwrap();
        assert!(nlwc.summary.contains("LAD def CIN 2–0"), "{}", nlwc.summary);
        assert!(nlwc.summary.contains("CHC def SD 2–1"), "{}", nlwc.summary);

        assert_eq!(v.current.len(), 1);
        let nlds = round(&v, "NLDS");
        assert_eq!(nlds.best_of, Some(5));
        let lad = nlds.series.iter().find(|s| s.a == "LAD").unwrap();
        assert_eq!((lad.a_wins, lad.b.as_str(), lad.b_wins), (3, "PHI", 1));
        assert!(lad.done && lad.mine);
        assert_eq!(lad.detail, "Final");
        let mil = nlds
            .series
            .iter()
            .find(|s| s.a == "MIL" || s.b == "MIL")
            .unwrap();
        assert_eq!((mil.a_wins, mil.b_wins), (2, 2));
        assert!(!mil.done);
        assert_eq!(mil.detail, "Series tied 2-2");
        assert!(v.upcoming.is_empty());
    }

    #[test]
    fn team_status_reads_alive_out_and_missed() {
        let b = boards(Y2025);
        let now = at("2025-10-11T12:00:00Z");
        assert_eq!(
            build_postseason(&b, "19", now).1,
            TeamPostStatus::Alive("Won the NLDS 3–1".into())
        );
        assert_eq!(
            build_postseason(&b, "22", now).1,
            TeamPostStatus::Ended("Out in NLDS, 1–3 to LAD".into())
        );
        assert_eq!(
            build_postseason(&b, "17", now).1,
            TeamPostStatus::Ended("Out in NLWC, 0–2 to LAD".into())
        );
        assert_eq!(
            build_postseason(&b, "8", now).1,
            TeamPostStatus::Alive("NLDS · tied 2–2 · best of 5".into())
        );
        assert_eq!(build_postseason(&b, "15", now).1, TeamPostStatus::Missed);
    }

    /// With nothing left to play, the last round's winner is the champion.
    #[test]
    fn a_team_that_won_the_last_round_played_has_ended_as_champion() {
        let only_alds: Vec<serde_json::Value> = boards(Y2025)
            .into_iter()
            .map(|mut sb| {
                let keep: Vec<serde_json::Value> = sb["events"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .filter(|e| {
                        e["competitions"][0]["notes"][0]["headline"]
                            .as_str()
                            .unwrap_or("")
                            .starts_with("ALDS")
                    })
                    .cloned()
                    .collect();
                sb["events"] = serde_json::Value::Array(keep);
                sb
            })
            .collect();
        let (v, status) = build_postseason(&only_alds, "14", at("2025-10-11T12:00:00Z"));
        assert!(v.current.is_empty());
        assert_eq!(
            status,
            TeamPostStatus::Ended("Won the ALDS, 3–1 over NYY".into())
        );
    }

    /// The day before 2026's postseason: Wild Card series set but unplayed;
    /// Division Series scheduled against placeholders (negative ids).
    #[test]
    fn opening_day_has_unplayed_series_current_and_placeholder_rounds_upcoming() {
        let (v, _) = build_postseason(&boards(Y2026), "19", at("2026-09-28T20:00:00Z"));
        let wc: Vec<&str> = v.current.iter().map(|r| r.round.as_str()).collect();
        assert!(wc.contains(&"NLWC") && wc.contains(&"ALWC"), "{wc:?}");
        let nlwc = round(&v, "NLWC");
        let atl = nlwc
            .series
            .iter()
            .find(|s| s.a == "ATL" || s.b == "ATL")
            .unwrap();
        assert_eq!((atl.a_wins, atl.b_wins), (0, 0));
        assert_eq!(atl.detail, "G1");
        assert_eq!(atl.next_starts_at.as_deref(), Some("2026-09-29T18:00Z"));
        let up: Vec<&str> = v.upcoming.iter().map(|r| r.round.as_str()).collect();
        assert!(up.contains(&"ALDS") && up.contains(&"NLDS"), "{up:?}");
        assert!(v.completed.is_empty());
    }

    /// A bye is not a miss: LAD appears only against an NLDS placeholder.
    #[test]
    fn a_team_with_a_bye_is_alive_not_missed() {
        let b = boards(Y2026);
        let now = at("2026-09-28T20:00:00Z");
        assert_eq!(
            build_postseason(&b, "19", now).1,
            TeamPostStatus::Alive("NLDS next".into())
        );
        assert_eq!(
            build_postseason(&b, "15", now).1,
            TeamPostStatus::Alive("NLWC · series opens · best of 3".into())
        );
    }

    #[test]
    fn no_postseason_events_is_unknown_not_missed() {
        let (v, status) = build_postseason(&[], "19", at("2026-09-28T20:00:00Z"));
        assert!(v.current.is_empty() && v.completed.is_empty() && v.upcoming.is_empty());
        assert_eq!(status, TeamPostStatus::Unknown);
    }
}

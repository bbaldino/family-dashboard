//! Aggregation for the Sporting Page — the `/sports/section` endpoint.
//!
//! Turns the per-league ESPN feeds (scoreboard, team detail, schedule,
//! standings, news, season leaders, postseason days) into one `SportsSection`:
//! one column per followed league, shaped by the league's `Phase` and ordered
//! postseason → regular season → preseason → off-season, plus the masthead's
//! season clock. The frontend lays this out verbatim; see `section-types.ts`
//! there for the matching shape.

use chrono::{DateTime, Duration, NaiveDate, Utc};
use serde::Serialize;

use super::espn;
use super::routes::SportsState;
use super::types::{LEAGUES, TrackedTeam};

mod leaders;
pub mod news;
pub mod postseason;
pub mod scores;
pub mod season;
pub mod standings;
pub mod team;

use leaders::build_leaders;
use news::{BriefItem, brief_items};
use postseason::{
    POSTSEASON_LOOKAHEAD_DAYS, PostseasonView, TeamPostStatus, build_postseason, postseason_days,
};
use scores::{ScoreSlate, parse_slate};
use season::{Phase, clock_for, parse_post_window, parse_season, phase_detail, phase_for};
use standings::parse_standings;
use team::{LastGame, NextGame, card_games, record_summary, schedule_events, team_events};

// ─── Output shape (mirrors the frontend `SportsSection`) ─────────────────

#[derive(Serialize)]
pub struct SportsSection {
    pub clock: Vec<ClockEntry>,
    pub columns: Vec<SportColumn>,
}

#[derive(Serialize, Clone)]
pub struct ClockEntry {
    pub league: String,
    pub detail: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SportColumn {
    pub league: String,
    pub team: String,
    pub team_abbr: String,
    pub phase: Phase,
    pub phase_detail: String,
    pub card: TeamCard,
    pub table: Option<StandingsTable>,
    pub scores: Option<ScoreSlate>,
    pub postseason: Option<PostseasonView>,
    pub brief: Vec<BriefItem>,
    pub leaders: Option<Vec<LeaderCategory>>,
    pub hot: Option<Vec<StreakRow>>,
    pub cold: Option<Vec<StreakRow>>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TeamCard {
    pub record: Option<String>,
    pub standing: Option<String>,
    pub streak: Option<String>,
    pub home: Option<String>,
    pub road: Option<String>,
    pub last10: Option<String>,
    pub last: Option<LastGame>,
    pub next: Option<NextGame>,
    pub series_status: Option<String>,
    pub season_ended: Option<String>,
}

#[derive(Serialize)]
pub struct StandingsTable {
    pub title: String,
    pub rows: Vec<TableRow>,
}

#[derive(Serialize)]
pub struct TableRow {
    pub t: String,
    pub w: i64,
    pub l: i64,
    pub pct: String,
    pub gb: String,
    pub strk: String,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub me: bool,
}

#[derive(Serialize, serde::Deserialize)]
pub struct LeaderCategory {
    pub cat: String,
    pub abbr: String,
    /// `[name, team, value]` per leader.
    pub rows: Vec<[String; 3]>,
}

#[derive(Serialize)]
pub struct StreakRow {
    pub t: String,
    pub rec: String,
    pub strk: String,
}

// ─── Route orchestration ─────────────────────────────────────────────────

fn non_empty(s: String) -> Option<String> {
    (!s.is_empty()).then_some(s)
}

/// One column per supported league, for the first tracked team in it, keeping
/// the configured order (the tie-break between columns of the same phase).
pub fn league_slots(
    tracked: &[TrackedTeam],
) -> Vec<(
    usize,
    &TrackedTeam,
    (&'static str, &'static str, &'static str),
)> {
    let mut seen = std::collections::HashSet::new();
    tracked
        .iter()
        .enumerate()
        .filter_map(|(i, t)| {
            let league = *LEAGUES.iter().find(|(id, _, _)| *id == t.league)?;
            seen.insert(league.0).then_some((i, t, league))
        })
        .collect()
}

/// Page order: postseason, regular season, preseason, off-season; columns in
/// the same phase keep their tracked-teams order (the `usize`).
fn order_columns<T>(columns: &mut [(usize, T)], phase: impl Fn(&T) -> Phase) {
    columns.sort_by_key(|(i, c)| (phase(c), *i));
}

async fn articles(state: &SportsState, url: &str) -> Vec<serde_json::Value> {
    espn::fetch_json(&state.client, url)
        .await
        .ok()
        .and_then(|v| v.get("articles").and_then(|a| a.as_array()).cloned())
        .unwrap_or_default()
}

/// The postseason's dates for a season, cached half a day.
async fn post_window(
    state: &SportsState,
    sport: &str,
    league: &str,
    year: i32,
) -> Option<(NaiveDate, NaiveDate)> {
    if year == 0 {
        return None;
    }
    let key = format!("postwindow:{league}:{year}");
    let v = match state.cache.get(&key, 12 * 3600).await {
        Some(v) => v,
        None => {
            let v = espn::fetch_json(
                &state.client,
                &espn::season_type_url(sport, league, year, 3),
            )
            .await
            .ok()?;
            state.cache.set(&key, v.clone()).await;
            v
        }
    };
    parse_post_window(&v)
}

/// Every postseason day's scoreboard, one request per day. A day before
/// yesterday is settled and cached for good; yesterday (late finishes),
/// today and the days ahead are refetched every few minutes.
async fn postseason_boards(
    state: &SportsState,
    sport: &str,
    league: &str,
    days: &[String],
    today: NaiveDate,
) -> Vec<serde_json::Value> {
    let settled_before = (today - Duration::days(1)).format("%Y%m%d").to_string();
    let fetches = days.iter().map(|day| {
        let settled = day.as_str() < settled_before.as_str();
        async move {
            let key = format!("postday:{league}:{day}");
            let max_age = if settled { u64::MAX } else { 300 };
            if let Some(v) = state.cache.get(&key, max_age).await {
                return Some(v);
            }
            let v = espn::fetch_scoreboard(&state.client, sport, league, day)
                .await
                .ok()?;
            state.cache.set(&key, v.clone()).await;
            Some(v)
        }
    });
    futures::future::join_all(fetches)
        .await
        .into_iter()
        .flatten()
        .collect()
}

/// One league's column. `None` only when the league's scoreboard or the
/// team's own detail can't be read — without those there's no phase or card.
/// Everything else degrades within its own block.
async fn build_column(
    state: &SportsState,
    (league_id, sport, league): (&'static str, &'static str, &'static str),
    team_id: &str,
    now: DateTime<Utc>,
) -> Option<(SportColumn, ClockEntry)> {
    let today = now.date_naive();
    let days = [
        (today - Duration::days(1)).format("%Y%m%d").to_string(),
        today.format("%Y%m%d").to_string(),
    ];
    let scoreboard = espn::fetch_scoreboard_window(&state.client, sport, league, &days)
        .await
        .ok()?;
    let payload = espn::fetch_json(
        &state.client,
        &espn::team_detail_url(sport, league, team_id),
    )
    .await
    .ok()?;
    let team = payload.get("team").cloned().unwrap_or(payload);

    let season = parse_season(&scoreboard);
    let window = post_window(state, sport, league, season.year).await;
    let phase = phase_for(&season, window, today);
    let text = |k: &str| team[k].as_str().unwrap_or("").to_string();
    let (display, abbr) = (text("displayName"), text("abbreviation"));
    let short = non_empty(text("shortDisplayName")).unwrap_or_else(|| display.clone());
    let league_tag = league_id.to_uppercase();

    let (team_news_url, league_news_url) = (
        espn::team_news_url(sport, league, team_id),
        espn::league_news_url(sport, league),
    );
    let (team_news, league_news) = tokio::join!(
        articles(state, &team_news_url),
        articles(state, &league_news_url),
    );

    let mut card = TeamCard {
        record: non_empty(record_summary(&team, "total")),
        standing: non_empty(text("standingSummary")),
        home: non_empty(record_summary(&team, "home")),
        road: non_empty(record_summary(&team, "road")),
        ..TeamCard::default()
    };
    let mut column = SportColumn {
        league: league_tag.clone(),
        team: display,
        team_abbr: abbr.clone(),
        phase,
        phase_detail: phase_detail(phase, &season, today),
        card: TeamCard::default(),
        table: None,
        scores: None,
        postseason: None,
        brief: brief_items(&team_news, &league_news, &short, &league_tag),
        leaders: None,
        hot: None,
        cold: None,
    };

    match phase {
        Phase::Regular => {
            let standings_url = espn::standings_url(sport, league);
            let schedule_url = espn::team_schedule_url(sport, league, team_id, season.year);
            let (standings, schedule, leaders) = tokio::join!(
                espn::fetch_json(&state.client, &standings_url),
                espn::fetch_json(&state.client, &schedule_url),
                build_leaders(state, sport, league, season.year),
            );
            let standings = parse_standings(&standings.unwrap_or(serde_json::Value::Null), &abbr);
            if let Some(t) = &standings.team {
                card.streak = non_empty(t.streak.clone());
                card.last10 = t.last10.clone();
            }
            let schedule = schedule.ok();
            let candidates = team_events(&team)
                .into_iter()
                .chain(schedule.as_ref().map(schedule_events).unwrap_or_default());
            (card.last, card.next) = card_games(candidates, team_id, now);
            column.table = Some(StandingsTable {
                title: standings.title,
                rows: standings.rows,
            });
            column.scores = Some(parse_slate(&scoreboard, &abbr));
            column.leaders = (!leaders.is_empty()).then_some(leaders);
            column.hot = Some(standings.hot);
            column.cold = Some(standings.cold);
        }
        Phase::Postseason => {
            let (start, _) = window?;
            let boards = postseason_boards(
                state,
                sport,
                league,
                &postseason_days(start, today, POSTSEASON_LOOKAHEAD_DAYS),
                today,
            )
            .await;
            let (view, status) = build_postseason(&boards, team_id, now);
            let events = boards
                .iter()
                .flat_map(|b| b["events"].as_array().into_iter().flatten());
            (card.last, card.next) =
                card_games(team_events(&team).into_iter().chain(events), team_id, now);
            match status {
                TeamPostStatus::Alive(s) => card.series_status = Some(s),
                TeamPostStatus::Ended(s) => card.season_ended = Some(s),
                TeamPostStatus::Missed => card.season_ended = Some("Missed the postseason".into()),
                TeamPostStatus::Unknown => {}
            }
            column.postseason = Some(view);
        }
        Phase::Preseason | Phase::Offseason => {
            (_, card.next) = card_games(team_events(&team), team_id, now);
        }
    }
    column.card = card;

    let clock = ClockEntry {
        league: league_tag,
        detail: clock_for(phase, &season, today),
    };
    Some((column, clock))
}

/// The Sporting Page — `/sports/section`: one column per followed league,
/// postseason first, then regular season, preseason, off-season.
pub async fn get_section(
    axum::extract::State(state): axum::extract::State<SportsState>,
) -> Result<axum::Json<SportsSection>, crate::error::AppError> {
    let config = crate::integrations::IntegrationConfig::new(&state.pool, super::INTEGRATION_ID);
    let tracked: Vec<TrackedTeam> = config.get_json_or("tracked_teams", vec![]).await?;
    let now = Utc::now();

    let builds = league_slots(&tracked).into_iter().map(|(i, t, league)| {
        let state = &state;
        async move {
            build_column(state, league, &t.team_id, now)
                .await
                .map(|b| (i, b))
        }
    });
    let mut built: Vec<(usize, (SportColumn, ClockEntry))> = futures::future::join_all(builds)
        .await
        .into_iter()
        .flatten()
        .collect();
    order_columns(&mut built, |(c, _)| c.phase);

    Ok(axum::Json(SportsSection {
        clock: built.iter().map(|(_, (_, k))| k.clone()).collect(),
        columns: built.into_iter().map(|(_, (c, _))| c).collect(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tracked(json: serde_json::Value) -> Vec<super::super::types::TrackedTeam> {
        serde_json::from_value(json).unwrap()
    }

    #[test]
    fn columns_order_by_phase_then_tracked_order() {
        let mut built = vec![
            (0, Phase::Offseason),
            (1, Phase::Regular),
            (2, Phase::Preseason),
            (3, Phase::Regular),
            (4, Phase::Postseason),
        ];
        order_columns(&mut built, |p| *p);
        let got: Vec<usize> = built.iter().map(|(i, _)| *i).collect();
        assert_eq!(got, [4, 1, 3, 2, 0]);
    }

    #[test]
    fn one_slot_per_league_in_configured_order_unknown_leagues_skipped() {
        let t = tracked(serde_json::json!([
            { "league": "mlb", "teamId": "19" },
            { "league": "xfl", "teamId": "1" },
            { "league": "nfl", "teamId": "25" },
            { "league": "mlb", "teamId": "26" },
        ]));
        let slots = league_slots(&t);
        let got: Vec<(usize, &str)> = slots
            .iter()
            .map(|(i, team, _)| (*i, team.team_id.as_str()))
            .collect();
        assert_eq!(got, [(0, "19"), (2, "25")]);
        assert_eq!(slots[0].2, ("mlb", "baseball", "mlb"));
    }
}

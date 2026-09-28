//! Aggregation for the Sporting Page — the `/sports/section` endpoint.
//!
//! Turns the per-league ESPN feeds (scoreboard, team detail, standings, news,
//! season leaders) into one `SportsSection`: leagues ranked by season type,
//! the top one or two rendered as full tracks, the rest as brief "elsewhere"
//! entries. The frontend lays this out verbatim; see `section-types.ts` there
//! for the matching shape.

use serde::Serialize;

use super::espn;

mod leaders;
mod news;
mod scores;
mod season;
mod standings;
mod team;

use leaders::build_leaders;
use news::{NewsShape, shape_news};
use scores::parse_scores;
use season::{SeasonInfo, clock_detail, parse_season, season_rank, season_underway};
use standings::parse_standings;
use team::{TeamDetail, parse_team_detail};

// ─── Output shape (mirrors the frontend `SportsSection`) ─────────────────

#[derive(Serialize, Default)]
pub struct SportsSection {
    pub fixtures: Vec<Fixture>,
    pub clock: Vec<ClockEntry>,
    pub standfirst: String,
    pub leagues: Vec<SportsTrack>,
    pub elsewhere: Vec<ElsewhereEntry>,
}

#[derive(Serialize)]
pub struct Fixture {
    pub team: String,
    pub detail: String,
}

#[derive(Serialize)]
pub struct ClockEntry {
    pub league: String,
    pub detail: String,
}

#[derive(Serialize)]
pub struct SportsTrack {
    pub league: String,
    pub team: String,
    #[serde(rename = "seasonType")]
    pub season_type: String,
    pub record: String,
    pub standing: String,
    pub home: String,
    pub away: String,
    pub next: String,
    pub headline: String,
    pub dek: String,
    pub caption: String,
    pub more: Vec<MoreStory>,
    pub table: StandingsTable,
    #[serde(rename = "scoresLabel")]
    pub scores_label: String,
    pub scores: Vec<ScoreRow>,
    pub leaders: Vec<LeaderCategory>,
    pub hot: Vec<StreakRow>,
    pub cold: Vec<StreakRow>,
}

#[derive(Serialize)]
pub struct MoreStory {
    pub h: String,
    pub dek: String,
    pub meta: String,
}

#[derive(Serialize)]
pub struct StandingsTable {
    pub title: String,
    pub sub: String,
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

#[derive(Serialize)]
pub struct ScoreRow {
    pub a: String,
    #[serde(rename = "as")]
    pub away_score: i64,
    pub h: String,
    pub hs: i64,
    pub star: String,
    pub line: String,
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

#[derive(Serialize)]
pub struct ElsewhereEntry {
    pub league: String,
    pub team: String,
    /// `null` off-season, a real `0-0` in preseason.
    pub record: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tag: Option<String>,
    pub note: String,
    pub story: BriefStory,
}

#[derive(Serialize)]
pub struct BriefStory {
    pub h: String,
    pub meta: String,
}

// ─── Route orchestration ─────────────────────────────────────────────────

/// One league's fetched inputs, before it is shaped into a track or an
/// elsewhere entry.
struct LeagueCtx {
    league_id: String,
    sport: &'static str,
    league: &'static str,
    team_id: String,
    /// The team object from `/teams/{id}` (the `team` field, unwrapped).
    team: serde_json::Value,
    season: SeasonInfo,
    scoreboard: serde_json::Value,
}

fn team_str<'a>(ctx: &'a LeagueCtx, key: &str) -> &'a str {
    ctx.team.get(key).and_then(|v| v.as_str()).unwrap_or("")
}

async fn build_track(
    state: &super::routes::SportsState,
    ctx: &LeagueCtx,
    detail: &TeamDetail,
    scores_label: &str,
) -> SportsTrack {
    let abbr = team_str(ctx, "abbreviation");

    let standings = espn::fetch_json(&state.client, &espn::standings_url(ctx.sport, ctx.league))
        .await
        .unwrap_or(serde_json::Value::Null);
    let standings = parse_standings(&standings, abbr);

    let news = espn::fetch_json(
        &state.client,
        &espn::team_news_url(ctx.sport, ctx.league, &ctx.team_id),
    )
    .await
    .ok()
    .and_then(|v| v.get("articles").and_then(|a| a.as_array()).cloned())
    .unwrap_or_default();
    let news = shape_news(&news);

    let leaders = build_leaders(state, ctx.sport, ctx.league, ctx.season.year).await;

    SportsTrack {
        league: ctx.league_id.to_uppercase(),
        team: team_str(ctx, "displayName").to_string(),
        season_type: ctx.season.season_type.clone(),
        record: detail.record.clone(),
        standing: detail.standing.clone(),
        home: detail.home.clone(),
        away: detail.away.clone(),
        next: detail.next.clone(),
        headline: news.headline,
        dek: news.dek,
        // No real photo caption in the feed; the plate stands in for the art.
        caption: String::new(),
        more: news.more,
        table: StandingsTable {
            // No sub: the division title stands alone. The mock's contextual
            // subs ("top of the table", "six to play") can't be generated
            // without an editorial line the feed doesn't carry, and repeating
            // the standing here just echoes the lead above it.
            title: standings.title,
            sub: String::new(),
            rows: standings.rows,
        },
        scores_label: scores_label.to_string(),
        scores: parse_scores(&ctx.scoreboard, abbr),
        leaders,
        hot: standings.hot,
        cold: standings.cold,
    }
}

/// A below-the-fold league: its followed team's status and one headline. Off
/// the top rank, so it gets no track. A record present (preseason `0-0`) shows
/// with a tag; absent (off-season) shows the countdown alone.
fn build_elsewhere(
    ctx: &LeagueCtx,
    detail: &TeamDetail,
    now: chrono::NaiveDate,
    news: &NewsShape,
) -> ElsewhereEntry {
    let in_season = season_rank(&ctx.season.season_type) < 3;
    let record = if in_season && !detail.record.is_empty() {
        Some(detail.record.clone())
    } else {
        None
    };
    let tag = match ctx.season.season_type.as_str() {
        "Preseason" => Some("preseason".to_string()),
        _ => None,
    };
    let note = clock_note(&ctx.season, now, detail);

    ElsewhereEntry {
        league: ctx.league_id.to_uppercase(),
        team: ctx
            .team
            .get("displayName")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        record,
        tag,
        note,
        story: BriefStory {
            h: news.headline.clone(),
            meta: news.lead_meta.clone(),
        },
    }
}

/// The prose note under an elsewhere team — a countdown before the season opens
/// ("Season opens Sep 30 · 44 days out"), the next game once it has, or a bare
/// season-type phrase as a fallback.
fn clock_note(season: &SeasonInfo, now: chrono::NaiveDate, detail: &TeamDetail) -> String {
    if let Some(start) = season.start
        && now < start
    {
        let days = (start - now).num_days();
        return format!(
            "Season opens {} · {} days out",
            start.format("%b %-d"),
            days
        );
    }
    if !detail.next.is_empty() {
        return format!("Next: {}", detail.next);
    }
    season.season_type.to_lowercase()
}

/// The Sporting Page — `/sports/section`.
pub async fn get_section(
    axum::extract::State(state): axum::extract::State<super::routes::SportsState>,
) -> Result<axum::Json<SportsSection>, crate::error::AppError> {
    let config = crate::integrations::IntegrationConfig::new(&state.pool, super::INTEGRATION_ID);
    let tracked: Vec<super::types::TrackedTeam> =
        config.get_json_or("tracked_teams", vec![]).await?;
    if tracked.is_empty() {
        return Ok(axum::Json(SportsSection::default()));
    }

    let today = chrono::Utc::now().date_naive();
    let yesterday = today - chrono::Duration::days(1);
    let scores_label = format!("{}'s", yesterday.format("%A"));
    // ESPN's scoreboard 400s on the `dates=YYYYMMDD-YYYYMMDD` range syntax —
    // fetch each day singly and let `fetch_scoreboard_window` merge them.
    let days = vec![
        yesterday.format("%Y%m%d").to_string(),
        today.format("%Y%m%d").to_string(),
    ];

    // One league context per tracked league (first tracked team wins its league).
    let mut ctxs: Vec<LeagueCtx> = Vec::new();
    for &(league_id, sport, league) in super::types::LEAGUES {
        let Some(team) = tracked.iter().find(|t| t.league == league_id) else {
            continue;
        };
        let Ok(scoreboard) =
            espn::fetch_scoreboard_window(&state.client, sport, league, &days).await
        else {
            continue;
        };
        let Ok(team_payload) = espn::fetch_json(
            &state.client,
            &espn::team_detail_url(sport, league, &team.team_id),
        )
        .await
        else {
            continue;
        };
        let team_obj = team_payload.get("team").cloned().unwrap_or(team_payload);
        ctxs.push(LeagueCtx {
            league_id: league_id.to_string(),
            sport,
            league,
            team_id: team.team_id.clone(),
            season: parse_season(&scoreboard),
            team: team_obj,
            scoreboard,
        });
    }
    if ctxs.is_empty() {
        return Ok(axum::Json(SportsSection::default()));
    }

    // Rank leagues; underway seasons lead over dormant ones (ESPN may still
    // label an off-season league "Regular Season"), season_rank as tiebreak.
    // The top two (at most) lead, the rest go to Elsewhere.
    ctxs.sort_by_key(|c| {
        (
            !season_underway(&c.season, today),
            season_rank(&c.season.season_type),
        )
    });

    let details: Vec<TeamDetail> = ctxs.iter().map(|c| parse_team_detail(&c.team)).collect();

    // Fixtures and clock cover every tracked league, in configured order.
    let fixtures: Vec<Fixture> = ctxs
        .iter()
        .zip(&details)
        .map(|(c, d)| Fixture {
            team: shorten_team(team_str(c, "displayName")),
            detail: if d.next.is_empty() {
                clock_note(&c.season, today, d)
            } else {
                d.next.clone()
            },
        })
        .collect();
    let clock: Vec<ClockEntry> = ctxs
        .iter()
        .map(|c| ClockEntry {
            league: c.league_id.to_uppercase(),
            detail: clock_detail(
                &c.season.season_type,
                today,
                c.season.start,
                c.season.end,
                c.season.week,
                c.season.total_weeks,
            ),
        })
        .collect();

    let mut leagues = Vec::new();
    let mut elsewhere = Vec::new();
    for (ctx, detail) in ctxs.iter().zip(&details) {
        if leagues.len() < 2 {
            leagues.push(build_track(&state, ctx, detail, &scores_label).await);
        } else {
            // Elsewhere still wants one headline, so fetch this league's news.
            let news = espn::fetch_json(
                &state.client,
                &espn::team_news_url(ctx.sport, ctx.league, &ctx.team_id),
            )
            .await
            .ok()
            .and_then(|v| v.get("articles").and_then(|a| a.as_array()).cloned())
            .unwrap_or_default();
            elsewhere.push(build_elsewhere(ctx, detail, today, &shape_news(&news)));
        }
    }

    // The lead story's dek stands in as the standfirst — a real sentence about
    // the day's biggest result. A cross-league LLM summary could replace it,
    // the same path preview and recap already use.
    let standfirst = leagues.first().map(|t| t.dek.clone()).unwrap_or_default();

    Ok(axum::Json(SportsSection {
        fixtures,
        clock,
        standfirst,
        leagues,
        elsewhere,
    }))
}

/// A team's short name for the fixtures ear — the last word of its display name
/// ("Los Angeles Dodgers" → "Dodgers"), matching the mock's ear.
fn shorten_team(display: &str) -> String {
    display
        .split_whitespace()
        .last()
        .unwrap_or(display)
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shortens_a_team_to_its_last_word() {
        assert_eq!(shorten_team("Los Angeles Dodgers"), "Dodgers");
        assert_eq!(shorten_team("Warriors"), "Warriors");
    }
}

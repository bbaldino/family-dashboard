use std::sync::Arc;

use axum::Json;
use axum::extract::{Query, State};
use serde::Deserialize;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

use super::cache::EspnCache;
use super::preview::PreviewCache;
use super::types::*;
use super::{INTEGRATION_ID, espn, transform};

#[derive(Clone)]
pub struct SportsState {
    pub pool: sqlx::SqlitePool,
    pub cache: EspnCache,
    pub client: reqwest::Client,
    pub preview_cache: Arc<PreviewCache>,
}

pub async fn get_games(State(state): State<SportsState>) -> Result<Json<GamesResponse>, AppError> {
    let config = IntegrationConfig::new(&state.pool, INTEGRATION_ID);

    let tracked: Vec<TrackedTeam> = config.get_json_or("tracked_teams", vec![]).await?;

    if tracked.is_empty() {
        return Ok(Json(GamesResponse {
            games: vec![],
            has_live: false,
        }));
    }

    let window_hours: f64 = config
        .get_or("window_hours", "24")
        .await?
        .parse()
        .unwrap_or(24.0);

    let poll_live: u64 = config
        .get_or("poll_interval_live", "30")
        .await?
        .parse()
        .unwrap_or(30);

    let poll_idle: u64 = config
        .get_or("poll_interval_idle", "900")
        .await?
        .parse()
        .unwrap_or(900);

    let mut leagues_needed: Vec<(&str, &str, &str)> = Vec::new();
    for &(league_id, sport, league) in LEAGUES {
        if tracked.iter().any(|t| t.league == league_id) {
            leagues_needed.push((league_id, sport, league));
        }
    }

    let mut all_games: Vec<Game> = Vec::new();
    let mut any_live = false;

    let had_live_previously = state.cache.has_live_flag().await;
    let max_age = if had_live_previously {
        poll_live
    } else {
        poll_idle
    };

    for (league_id, sport, league) in &leagues_needed {
        let tracked_ids: Vec<String> = tracked
            .iter()
            .filter(|t| t.league == *league_id)
            .map(|t| t.team_id.clone())
            .collect();

        let scoreboard = match state.cache.get(league_id, max_age).await {
            Some(cached) => cached,
            None => match espn::fetch_scoreboard(&state.client, sport, league).await {
                Ok(data) => {
                    state.cache.set(league_id, data.clone()).await;
                    data
                }
                Err(e) => {
                    tracing::warn!(
                        "ESPN fetch failed for {}, using stale cache: {}",
                        league_id,
                        e
                    );
                    match state.cache.get_stale(league_id).await {
                        Some(stale) => stale,
                        None => {
                            tracing::error!("No cached data for {}", league_id);
                            continue;
                        }
                    }
                }
            },
        };

        let games =
            transform::transform_scoreboard(&scoreboard, league_id, &tracked_ids, window_hours);

        for game in &games {
            if game.state == GameState::Live {
                any_live = true;
            }
        }
        all_games.extend(games);
    }

    state.cache.set_live_flag(any_live).await;

    // Sort: live first, then final (most recent first), then upcoming (soonest first)
    all_games.sort_by(|a, b| {
        let state_order = |s: &GameState| -> u8 {
            match s {
                GameState::Live => 0,
                GameState::Final => 1,
                GameState::Upcoming => 2,
                GameState::Postponed => 3,
            }
        };
        state_order(&a.state)
            .cmp(&state_order(&b.state))
            .then_with(|| {
                if a.state == GameState::Final {
                    b.start_time.cmp(&a.start_time) // most recent first
                } else {
                    a.start_time.cmp(&b.start_time) // soonest first
                }
            })
    });

    Ok(Json(GamesResponse {
        games: all_games,
        has_live: any_live,
    }))
}

#[derive(Deserialize)]
pub struct LeagueQuery {
    pub league: String,
}

pub async fn get_teams(
    State(state): State<SportsState>,
    Query(query): Query<LeagueQuery>,
) -> Result<Json<TeamsResponse>, AppError> {
    let (league_id, sport, league) = LEAGUES
        .iter()
        .find(|(id, _, _)| *id == query.league)
        .copied()
        .ok_or_else(|| AppError::BadRequest(format!("Unknown league: {}", query.league)))?;

    let teams = fetch_cached_teams(&state, league_id, sport, league).await?;
    Ok(Json(TeamsResponse { teams }))
}

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: String,
}

pub async fn search_teams(
    State(state): State<SportsState>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<TeamsResponse>, AppError> {
    let search = query.q.to_lowercase();
    let mut all_teams = Vec::new();

    for &(league_id, sport, league) in LEAGUES {
        let teams = fetch_cached_teams(&state, league_id, sport, league).await?;
        all_teams.extend(teams);
    }

    let filtered: Vec<TeamInfo> = all_teams
        .into_iter()
        .filter(|t| {
            t.name.to_lowercase().contains(&search)
                || t.display_name.to_lowercase().contains(&search)
                || t.abbreviation.to_lowercase().contains(&search)
        })
        .collect();

    Ok(Json(TeamsResponse { teams: filtered }))
}

#[derive(Deserialize)]
pub struct PreviewQuery {
    pub game_id: String,
}

pub async fn get_preview(
    State(state): State<SportsState>,
    Query(params): Query<PreviewQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Check cache first
    if let Some(summary) = state.preview_cache.get(&params.game_id) {
        return Ok(Json(serde_json::json!({ "summary": summary })));
    }

    // Build game context from cached ESPN data across all leagues
    let mut game_context = format!("Game ID: {}", params.game_id);
    for &(league_id, _, _) in LEAGUES {
        if let Some(data) = state.cache.get_stale(league_id).await {
            let games = transform::transform_scoreboard(&data, league_id, &[], 24.0);
            if let Some(game) = games.iter().find(|g| g.id == params.game_id) {
                let mut context = format!(
                    "Game: {} vs {}\nHome record: {}\nAway record: {}\nLeague: {}\nStart: {}",
                    game.away.name,
                    game.home.name,
                    game.home.record.as_deref().unwrap_or("?"),
                    game.away.record.as_deref().unwrap_or("?"),
                    game.league,
                    game.start_time,
                );
                if let Some(venue) = &game.venue {
                    context.push_str(&format!("\nVenue: {}", venue));
                }
                if let Some(broadcast) = &game.broadcast {
                    context.push_str(&format!("\nBroadcast: {}", broadcast));
                }
                if let Some(round) = &game.playoff_round {
                    context.push_str(&format!("\nPlayoff: {}", round));
                }
                if !game.athletes.is_empty() {
                    context.push_str("\nProbable pitchers:");
                    for athlete in &game.athletes {
                        let stats = athlete
                            .stats
                            .as_deref()
                            .map(|s| format!(" ({})", s))
                            .unwrap_or_default();
                        context
                            .push_str(&format!("\n  {} - {}{}", athlete.role, athlete.name, stats));
                    }
                }
                game_context = context;
                break;
            }
        }
    }

    let summary = super::preview::generate_preview(&state.pool, &game_context).await?;

    // Cache the result
    state.preview_cache.set(&params.game_id, summary.clone());

    Ok(Json(serde_json::json!({ "summary": summary })))
}

async fn fetch_cached_teams(
    state: &SportsState,
    league_id: &str,
    sport: &str,
    league: &str,
) -> Result<Vec<TeamInfo>, AppError> {
    let cache_key = format!("teams_{}", league_id);
    if let Some(cached) = state.cache.get(&cache_key, 86400).await {
        return Ok(transform::transform_teams(&cached, league_id));
    }
    let raw = espn::fetch_teams(&state.client, sport, league).await?;
    state.cache.set(&cache_key, raw.clone()).await;
    Ok(transform::transform_teams(&raw, league_id))
}

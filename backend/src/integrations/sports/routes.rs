use std::sync::Arc;

use axum::Json;
use axum::extract::{Query, State};
use serde::Deserialize;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

use super::cache::EspnCache;
use super::enrichment;
use super::final_recap::FinalRecapCache;
use super::preview::PreviewCache;
use super::recap::RecapCache;
use super::replay::Replayer;
use super::types::*;
use super::{INTEGRATION_ID, espn, recap, transform};

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum SportsEvent {
    /// "Please refetch /games now." Fires on scheduled-start wakeups so the
    /// frontend doesn't have to wait for its idle poll to notice the transition.
    Kick,
}

#[derive(Clone)]
pub struct SportsState {
    pub pool: sqlx::SqlitePool,
    pub cache: EspnCache,
    pub client: reqwest::Client,
    pub preview_cache: Arc<PreviewCache>,
    pub final_recap_cache: Arc<FinalRecapCache>,
    pub enrichment_cache: Arc<super::enrichment::EnrichmentCache>,
    pub recap_cache: Arc<RecapCache>,
    pub replayer: Option<Arc<Replayer>>,
    /// One-shot tokio task scheduled to fire at the earliest tracked game's
    /// start time. When it fires it sets `cache.has_live_flag = true` so the
    /// next poll switches to live cadence immediately — independent of how
    /// often the frontend is asking.
    pub start_timer: Arc<tokio::sync::Mutex<Option<tokio::task::JoinHandle<()>>>>,
    /// Broadcast channel for SSE clients. Send a SportsEvent to nudge every
    /// connected dashboard to refetch.
    pub events_tx: tokio::sync::broadcast::Sender<SportsEvent>,
}

fn replay_response(
    state: &SportsState,
    replayer: &Replayer,
) -> Result<Json<GamesResponse>, AppError> {
    let snapshot = replayer.current();
    let game_id = replayer.game_id();

    // Funnel snapshot through the same transform the live path uses. Pass
    // an empty tracked-team list (no team filter) and a year-wide window so
    // an old/finished fixture stays visible — then narrow the response to
    // just the captured game id.
    let all_games = transform::transform_scoreboard(&snapshot.scoreboard, "mlb", &[], 24.0 * 365.0);
    let mut games: Vec<Game> = all_games.into_iter().filter(|g| g.id == *game_id).collect();

    if let Some(game) = games.iter_mut().find(|g| g.id == *game_id)
        && let Some(mut detail) = transform::parse_summary_to_live_detail(&snapshot.summary)
    {
        attach_scoring_recap(state, game, &mut detail);
        game.live_detail = Some(detail);
    }

    let any_live = games.iter().any(|g| g.state == GameState::Live);
    Ok(Json(GamesResponse {
        games,
        has_live: any_live,
    }))
}

/// Attach the LLM-generated scoring recap to a MLB live detail if one is
/// cached, or kick off a background generation if it isn't. Completed
/// scoring plays = `scoring_plays` minus the tail `in_progress_scoring`
/// (the in-progress half-inning, which is always the chronological end).
fn attach_scoring_recap(state: &SportsState, game: &Game, detail: &mut LiveGameDetail) {
    let SportSpecificLive::Mlb(mlb) = &mut detail.sport_specific;

    if mlb.scoring_plays.len() <= mlb.in_progress_scoring.len() {
        return; // nothing in a completed inning yet
    }
    let completed_count = mlb.scoring_plays.len() - mlb.in_progress_scoring.len();
    let completed: Vec<Play> = mlb
        .scoring_plays
        .iter()
        .take(completed_count)
        .cloned()
        .collect();

    let through_inning = completed
        .last()
        .and_then(|p| match (&p.inning_half, p.inning_number) {
            (Some(half), Some(number)) => Some(InningRef {
                half: half.clone(),
                number,
            }),
            _ => None,
        });

    let key = recap::cache_key(&game.id, completed_count);
    if let Some(text) = state.recap_cache.get(&key) {
        mlb.scoring_recap = Some(ScoringRecap {
            text,
            through_inning,
        });
        return;
    }

    let mut team_abbrs = std::collections::HashMap::new();
    team_abbrs.insert(game.home.id.clone(), game.home.abbreviation.clone());
    team_abbrs.insert(game.away.id.clone(), game.away.abbreviation.clone());
    let ctx = recap::RecapContext {
        through_inning,
        current_period_label: game.period_label.clone(),
        home_abbr: game.home.abbreviation.clone(),
        away_abbr: game.away.abbreviation.clone(),
        team_abbrs,
    };

    // Not cached — kick off async generation. The cache will be populated
    // before the next poll (typically within a few seconds).
    recap::ensure_recap(
        state.recap_cache.clone(),
        state.pool.clone(),
        key,
        completed,
        ctx,
    );
}

pub async fn get_games(State(state): State<SportsState>) -> Result<Json<GamesResponse>, AppError> {
    // Replay mode: snapshot data only, ignore tracked teams / ESPN entirely.
    if let Some(replayer) = state.replayer.clone() {
        return replay_response(&state, &replayer);
    }

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

        let mut games =
            transform::transform_scoreboard(&scoreboard, league_id, &tracked_ids, window_hours);

        for game in games.iter_mut() {
            let is_live = game.state == GameState::Live;
            let is_final = game.state == GameState::Final;
            if !(is_live || is_final) {
                continue;
            }
            if is_live {
                any_live = true;
            }

            // 5s cache for live (needs freshness), 6h for finals (immutable).
            let ttl = if is_live { 5 } else { 21600 };
            let summary_key = format!("summary:{}", game.id);
            let summary_json = match state.cache.get(&summary_key, ttl).await {
                Some(cached) => Some(cached),
                None => match espn::fetch_summary(&state.client, sport, league, &game.id).await {
                    Ok(data) => {
                        state.cache.set(&summary_key, data.clone()).await;
                        Some(data)
                    }
                    Err(e) => {
                        tracing::warn!("ESPN summary fetch failed for game {}: {}", game.id, e);
                        state.cache.get_stale(&summary_key).await
                    }
                },
            };

            if let Some(summary) = summary_json
                && let Some(mut detail) = transform::parse_summary_to_live_detail(&summary)
            {
                if is_live {
                    // Live-only: LLM narrates in-progress scoring. Finals get
                    // the raw scoring-play list plus (separately) the AI recap.
                    attach_scoring_recap(&state, game, &mut detail);
                }
                game.live_detail = Some(detail);
            }
        }
        all_games.extend(games);
    }

    // "Should poll fast" widens has_live to include scheduled games whose
    // start time has already passed but ESPN hasn't yet flipped them to Live
    // — handles the case where the backend was idle when the game started.
    let now = chrono::Utc::now();
    let any_expected_live = all_games.iter().any(|g| {
        g.state == GameState::Upcoming
            && chrono::DateTime::parse_from_rfc3339(&g.start_time)
                .map(|t| t.with_timezone(&chrono::Utc) <= now)
                .unwrap_or(false)
    });
    let should_poll_fast = any_live || any_expected_live;

    state.cache.set_live_flag(should_poll_fast).await;

    // Schedule a one-shot wakeup for the earliest still-future upcoming start
    // time. When it fires, mark live polling active so the next request — even
    // an otherwise-idle one — switches to live cadence at the exact moment the
    // game is supposed to start, not whenever the next poll happens.
    schedule_next_start_wakeup(&state, &all_games, now).await;

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
        has_live: should_poll_fast,
    }))
}

async fn schedule_next_start_wakeup(
    state: &SportsState,
    games: &[Game],
    now: chrono::DateTime<chrono::Utc>,
) {
    let earliest = games
        .iter()
        .filter(|g| g.state == GameState::Upcoming)
        .filter_map(|g| {
            chrono::DateTime::parse_from_rfc3339(&g.start_time)
                .ok()
                .map(|t| t.with_timezone(&chrono::Utc))
        })
        .filter(|t| *t > now)
        .min();

    let mut guard = state.start_timer.lock().await;
    if let Some(prev) = guard.take() {
        prev.abort();
    }
    let Some(start) = earliest else {
        return;
    };
    let Ok(delay) = (start - now).to_std() else {
        return;
    };
    let cache = state.cache.clone();
    let events_tx = state.events_tx.clone();
    *guard = Some(tokio::spawn(async move {
        tokio::time::sleep(delay).await;
        cache.set_live_flag(true).await;
        tracing::info!("Scheduled game start reached — activating live polling cadence");
        // Nudge every connected SSE client to refetch immediately. send()
        // returns an error only when there are no subscribers, which is fine.
        let _ = events_tx.send(SportsEvent::Kick);
    }));
}

/// SSE: stream a tiny stream of refresh-nudge events to the frontend.
///
/// We don't push the games payload itself — clients still GET /games to get
/// real data. SSE just collapses the "wait until next idle poll" delay when
/// something meaningful (e.g. scheduled game start) happens server-side.
pub async fn events(State(state): State<SportsState>) -> impl axum::response::IntoResponse {
    use axum::response::sse::{Event, KeepAlive, Sse};
    use std::time::Duration;
    use tokio_stream::StreamExt;
    use tokio_stream::wrappers::BroadcastStream;

    let rx = state.events_tx.subscribe();
    let stream = BroadcastStream::new(rx).filter_map(|res| {
        let evt = res.ok()?;
        let json = serde_json::to_string(&evt).ok()?;
        Some(Ok::<_, std::convert::Infallible>(
            Event::default().event("kick").data(json),
        ))
    });
    let sse = Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("keepalive"),
    );
    (
        [
            (axum::http::header::CACHE_CONTROL, "no-cache"),
            (
                axum::http::header::HeaderName::from_static("x-accel-buffering"),
                "no",
            ),
        ],
        sse,
    )
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
    if let Some(summary) = state.preview_cache.get(&params.game_id) {
        return Ok(Json(serde_json::json!({ "summary": summary })));
    }

    let game_context = build_matchup_context(&state, &params.game_id)
        .await
        .unwrap_or_else(|| format!("Game ID: {}", params.game_id));

    let summary = super::preview::generate_preview(&state.pool, &game_context).await?;
    state.preview_cache.set(&params.game_id, summary.clone());
    Ok(Json(serde_json::json!({ "summary": summary })))
}

pub async fn get_final_recap(
    State(state): State<SportsState>,
    Query(params): Query<PreviewQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    if let Some(summary) = state.final_recap_cache.get(&params.game_id) {
        return Ok(Json(serde_json::json!({ "summary": summary })));
    }

    let game_context = build_matchup_context(&state, &params.game_id)
        .await
        .unwrap_or_else(|| format!("Game ID: {}", params.game_id));

    let summary = super::final_recap::generate_final_recap(&state.pool, &game_context).await?;
    state
        .final_recap_cache
        .set(&params.game_id, summary.clone());
    Ok(Json(serde_json::json!({ "summary": summary })))
}

/// Assemble the shared matchup context string used by both /preview and
/// /final-recap. Includes final scores + winner when the game is completed,
/// so the LLM has enough to write past-tense.
async fn build_matchup_context(state: &SportsState, game_id: &str) -> Option<String> {
    for &(league_id, _, _) in LEAGUES {
        if let Some(data) = state.cache.get_stale(league_id).await {
            let games = transform::transform_scoreboard(&data, league_id, &[], 24.0);
            if let Some(game) = games.iter().find(|g| g.id == game_id) {
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

                // Enrich with raw ESPN data (headlines, odds, team stats, leaders)
                let empty_events = vec![];
                let events = data["events"].as_array().unwrap_or(&empty_events);
                if let Some(event) = events.iter().find(|e| e["id"].as_str() == Some(game_id)) {
                    let comp = &event["competitions"][0];

                    // ESPN preview headline (e.g., "Rays play the Cubs in first of 3-game series")
                    if let Some(headline) = comp["headlines"]
                        .as_array()
                        .and_then(|h| h.first())
                        .and_then(|h| h["shortLinkText"].as_str())
                    {
                        context.push_str(&format!("\nSeries context: {}", headline));
                    }

                    // Odds
                    if let Some(odds) = comp["odds"].as_array().and_then(|o| o.first()) {
                        if let Some(details) = odds["details"].as_str() {
                            context.push_str(&format!("\nOdds: {}", details));
                        }
                        if let Some(ou) = odds["overUnder"].as_f64() {
                            context.push_str(&format!(", O/U {}", ou));
                        }
                    }

                    // Team stats and leaders for each competitor
                    let empty_comps = vec![];
                    let competitors = comp["competitors"].as_array().unwrap_or(&empty_comps);
                    for competitor in competitors {
                        let ha = competitor["homeAway"].as_str().unwrap_or("?");
                        let team_name = competitor["team"]["shortDisplayName"]
                            .as_str()
                            .unwrap_or("?");

                        // Home/away record
                        if let Some(records) = competitor["records"].as_array() {
                            let parts: Vec<String> = records
                                .iter()
                                .filter_map(|r| {
                                    let rtype = r["type"].as_str()?;
                                    let summary = r["summary"].as_str()?;
                                    if rtype == "total" {
                                        None // Already have overall record
                                    } else {
                                        Some(format!(
                                            "{}: {}",
                                            r["name"].as_str().unwrap_or(rtype),
                                            summary
                                        ))
                                    }
                                })
                                .collect();
                            if !parts.is_empty() {
                                context.push_str(&format!(
                                    "\n{} ({}) split records: {}",
                                    team_name,
                                    ha,
                                    parts.join(", ")
                                ));
                            }
                        }

                        // Team stats (batting avg, ERA, etc.)
                        if let Some(stats) = competitor["statistics"].as_array() {
                            let stat_lines: Vec<String> = stats
                                .iter()
                                .filter_map(|s| {
                                    let name = s["name"].as_str()?;
                                    let val = s["displayValue"].as_str()?;
                                    let rank = s["rankDisplayValue"].as_str().unwrap_or("");
                                    if rank.is_empty() {
                                        Some(format!("{}: {}", name, val))
                                    } else {
                                        Some(format!("{}: {} ({})", name, val, rank))
                                    }
                                })
                                .collect();
                            if !stat_lines.is_empty() {
                                context.push_str(&format!(
                                    "\n{} ({}) team stats: {}",
                                    team_name,
                                    ha,
                                    stat_lines.join(", ")
                                ));
                            }
                        }

                        // Team leaders
                        if let Some(leaders) = competitor["leaders"].as_array() {
                            let leader_lines: Vec<String> = leaders
                                .iter()
                                .filter_map(|l| {
                                    let cat = l["shortDisplayName"].as_str()?;
                                    let top = l["leaders"].as_array()?.first()?;
                                    let name = top["athlete"]["displayName"].as_str()?;
                                    let val = top["displayValue"].as_str()?;
                                    Some(format!("{}: {} ({})", cat, name, val))
                                })
                                .collect();
                            if !leader_lines.is_empty() {
                                context.push_str(&format!(
                                    "\n{} ({}) leaders: {}",
                                    team_name,
                                    ha,
                                    leader_lines.join(", ")
                                ));
                            }
                        }
                    }
                }

                // Enrichment: recent form, prior season, filtered team news.
                if let Some((sport, league)) = enrichment::sport_path(&game.league) {
                    let year = chrono::Utc::now()
                        .format("%Y")
                        .to_string()
                        .parse::<i32>()
                        .unwrap_or(2026);
                    let home_fut = enrichment::enrich_team(
                        &state.client,
                        &state.enrichment_cache,
                        sport,
                        league,
                        &game.home.id,
                        &game.home.name,
                        year,
                    );
                    let away_fut = enrichment::enrich_team(
                        &state.client,
                        &state.enrichment_cache,
                        sport,
                        league,
                        &game.away.id,
                        &game.away.name,
                        year,
                    );
                    let (home_enrich, away_enrich) = tokio::join!(home_fut, away_fut);

                    let home_block = enrichment::render(&home_enrich, &game.home.name);
                    let away_block = enrichment::render(&away_enrich, &game.away.name);
                    if !home_block.is_empty() {
                        context.push_str("\n\n");
                        context.push_str(&home_block);
                    }
                    if !away_block.is_empty() {
                        context.push_str("\n\n");
                        context.push_str(&away_block);
                    }
                }

                // Final games: give the LLM the score + winner so the recap can be
                // written past-tense. Harmless for previews since the preview handler
                // is only wired to upcoming-game cards on the frontend.
                if game.state == GameState::Final {
                    let hs = game.home.score.map(|v| v.to_string()).unwrap_or_default();
                    let as_ = game.away.score.map(|v| v.to_string()).unwrap_or_default();
                    let winner = if game.home.winner == Some(true) {
                        Some(game.home.name.as_str())
                    } else if game.away.winner == Some(true) {
                        Some(game.away.name.as_str())
                    } else {
                        None
                    };
                    context.push_str(&format!(
                        "\nFinal: {} {} - {} {}",
                        game.away.name, as_, hs, game.home.name
                    ));
                    if let Some(w) = winner {
                        context.push_str(&format!("\nWinner: {}", w));
                    }
                }

                return Some(context);
            }
        }
    }
    None
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

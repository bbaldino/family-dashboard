# Sports Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sports widget card showing live scores, finals, and upcoming games for tracked teams using ESPN's free API.

**Architecture:** Rust/Axum backend fetches and caches ESPN scoreboard data per league, filters to tracked teams, and serves a unified games endpoint. React frontend renders a `SportsWidget` inside a `WidgetCard` with adaptive polling (fast when live games exist). A custom `SportsSettings` component provides team search and per-league team pickers.

**Tech Stack:** Rust, Axum, reqwest, serde, tokio (caching), React, TypeScript, TanStack Query, Zod

**Spec:** `docs/superpowers/specs/2026-03-16-sports-integration-design.md`

---

## File Structure

### Backend (`backend/src/integrations/sports/`)

| File | Responsibility |
|------|---------------|
| `mod.rs` | Module exports, `INTEGRATION_ID`, `router()` function |
| `types.rs` | All serde structs: `Game`, `Team`, `Leader`, `GamesResponse`, `TeamsResponse`, ESPN raw response types |
| `espn.rs` | ESPN API client: fetch scoreboard, fetch teams, search teams. Pure HTTP + parsing, no Axum types |
| `cache.rs` | In-memory cache for ESPN responses per league with TTL-based staleness |
| `routes.rs` | Axum route handlers: `get_games`, `get_teams`, `search_teams` |
| `transform.rs` | Transform ESPN raw data → our `Game` type. Filter by tracked teams, time window. Sport-specific period labels and leader formatting |

### Frontend (`frontend/src/integrations/sports/`)

| File | Responsibility |
|------|---------------|
| `config.ts` | `defineIntegration()` call with Zod schema and `settingsComponent` |
| `types.ts` | TypeScript types matching backend response shapes |
| `useSportsGames.ts` | TanStack Query hook that fetches `/api/sports/games` with adaptive refetch interval |
| `SportsWidget.tsx` | Main widget component rendering game cards inside `WidgetCard` |
| `GameCard.tsx` | Single game row component — handles live/final/upcoming/postponed rendering |
| `SportsSettings.tsx` | Custom settings: team search + per-league team picker with checkboxes |
| `index.ts` | Barrel export |

### Modified files

| File | Change |
|------|--------|
| `backend/src/integrations/mod.rs` | Add `pub mod sports;` and `.nest("/sports", ...)` |
| `frontend/src/integrations/registry.ts` | Add `sportsIntegration` to array |
| `frontend/src/theme/variables.css` | Add `--color-sports` |
| `frontend/src/ui/WidgetCard.tsx` | Add `'sports'` to `CardCategory` type and `categoryColors` |
| `frontend/src/boards/HomeBoard.tsx` | Replace sports placeholder with `<SportsWidget />` |

---

## Chunk 1: Backend Foundation

### Task 1: Backend types and ESPN response structs

**Files:**
- Create: `backend/src/integrations/sports/mod.rs`
- Create: `backend/src/integrations/sports/types.rs`
- Modify: `backend/src/integrations/mod.rs`

- [ ] **Step 1: Create the sports module skeleton**

Create `backend/src/integrations/sports/mod.rs`:
```rust
pub mod types;

use axum::Router;
use sqlx::SqlitePool;

pub const INTEGRATION_ID: &str = "sports";

pub fn router(_pool: SqlitePool) -> Router {
    Router::new()
}
```

- [ ] **Step 2: Register the sports module**

In `backend/src/integrations/mod.rs`, add `pub mod sports;` with the other module declarations, and add `.nest("/sports", sports::router(pool.clone()))` in the `router()` function.

- [ ] **Step 3: Define our API response types**

Create `backend/src/integrations/sports/types.rs` with all the types from the spec:

```rust
use serde::{Deserialize, Serialize};

/// A team in a game (home or away)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameTeam {
    pub id: String,
    pub name: String,
    pub abbreviation: String,
    pub logo: String,
    pub record: Option<String>,
    pub score: Option<i32>,
    pub winner: Option<bool>,
}

/// A stat leader line
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Leader {
    pub team: String, // "home" or "away"
    pub name: String,
    pub stats: String,
}

/// Game state
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum GameState {
    Live,
    Final,
    Upcoming,
    Postponed,
}

/// A single game in our API response
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Game {
    pub id: String,
    pub league: String,
    pub state: GameState,
    pub name: String,
    pub start_time: String,
    pub venue: Option<String>,
    pub broadcast: Option<String>,
    pub playoff_round: Option<String>,
    pub home: GameTeam,
    pub away: GameTeam,
    pub clock: Option<String>,
    pub period: Option<i32>,
    pub period_label: Option<String>,
    pub leaders: Vec<Leader>,
    pub situation: Option<String>,
}

/// Response for GET /api/sports/games
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GamesResponse {
    pub games: Vec<Game>,
    pub has_live: bool,
}

/// A team for the team picker
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamInfo {
    pub id: String,
    pub name: String,
    pub display_name: String,
    pub abbreviation: String,
    pub logo: String,
    pub league: String,
}

/// Response for GET /api/sports/teams
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamsResponse {
    pub teams: Vec<TeamInfo>,
}

/// Tracked team entry stored in config JSON
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackedTeam {
    pub league: String,
    pub team_id: String,
}

/// Supported leagues
pub const LEAGUES: &[(&str, &str, &str)] = &[
    ("nba", "basketball", "nba"),
    ("nfl", "football", "nfl"),
    ("mlb", "baseball", "mlb"),
    ("nhl", "hockey", "nhl"),
];
```

- [ ] **Step 4: Verify it compiles**

Run: `cd backend && cargo check`
Expected: compiles with no errors

- [ ] **Step 5: Commit**

```bash
git add backend/src/integrations/sports/ backend/src/integrations/mod.rs
git commit -m "feat(sports): add module skeleton and API response types"
```

---

### Task 2: ESPN API client

**Files:**
- Create: `backend/src/integrations/sports/espn.rs`
- Modify: `backend/src/integrations/sports/mod.rs`

- [ ] **Step 1: Create the ESPN client module**

Create `backend/src/integrations/sports/espn.rs`. This module handles raw HTTP calls to ESPN and deserializes their response format. Use `serde_json::Value` for the raw ESPN data to avoid mapping their entire schema — we only extract what we need in the transform layer.

```rust
use crate::error::AppError;

const ESPN_BASE: &str = "https://site.api.espn.com/apis/site/v2/sports";

/// Fetch the scoreboard for a given sport/league from ESPN.
/// Returns the raw JSON value.
pub async fn fetch_scoreboard(
    client: &reqwest::Client,
    sport: &str,
    league: &str,
) -> Result<serde_json::Value, AppError> {
    let url = format!("{}/{}/{}/scoreboard", ESPN_BASE, sport, league);
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

/// Fetch all teams for a given sport/league from ESPN.
pub async fn fetch_teams(
    client: &reqwest::Client,
    sport: &str,
    league: &str,
) -> Result<serde_json::Value, AppError> {
    let url = format!(
        "{}/{}/{}/teams?limit=100",
        ESPN_BASE, sport, league
    );
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
```

- [ ] **Step 2: Export from mod.rs**

Add `pub mod espn;` to `backend/src/integrations/sports/mod.rs`.

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && cargo check`

- [ ] **Step 4: Commit**

```bash
git add backend/src/integrations/sports/
git commit -m "feat(sports): add ESPN API client"
```

---

### Task 3: ESPN response transformation

**Files:**
- Create: `backend/src/integrations/sports/transform.rs`
- Modify: `backend/src/integrations/sports/mod.rs`

This is the most complex backend piece — it takes raw ESPN JSON and produces our clean `Game` and `TeamInfo` types.

- [ ] **Step 1: Create the transform module**

Create `backend/src/integrations/sports/transform.rs`:

```rust
use crate::integrations::sports::types::*;

/// Transform ESPN scoreboard JSON into our Game types.
/// Filters to only games involving tracked teams within the time window.
pub fn transform_scoreboard(
    raw: &serde_json::Value,
    league_id: &str,
    tracked_team_ids: &[String],
    window_hours: f64,
) -> Vec<Game> {
    let now = chrono::Utc::now();
    let empty = vec![];
    let events = raw["events"].as_array().unwrap_or(&empty);

    events
        .iter()
        .filter_map(|event| {
            let competition = &event["competitions"][0];
            let game = parse_game(event, competition, league_id)?;

            // Filter: must involve a tracked team
            if !tracked_team_ids.is_empty()
                && !tracked_team_ids.contains(&game.home.id)
                && !tracked_team_ids.contains(&game.away.id)
            {
                return None;
            }

            // Filter by time window (live games always included)
            if game.state != GameState::Live {
                if let Ok(start) = chrono::DateTime::parse_from_rfc3339(&game.start_time) {
                    let start_utc = start.with_timezone(&chrono::Utc);
                    let hours_diff = (now - start_utc).num_minutes() as f64 / 60.0;
                    if game.state == GameState::Final || game.state == GameState::Postponed {
                        if hours_diff > window_hours {
                            return None;
                        }
                    } else {
                        // upcoming
                        if -hours_diff > window_hours {
                            return None;
                        }
                    }
                }
            }

            Some(game)
        })
        .collect()
}

fn parse_game(
    event: &serde_json::Value,
    competition: &serde_json::Value,
    league_id: &str,
) -> Option<Game> {
    let id = event["id"].as_str()?.to_string();
    let name = event["name"].as_str().unwrap_or("").to_string();
    let start_time = event["date"].as_str().unwrap_or("").to_string();

    // Venue
    let venue = competition["venue"]["fullName"]
        .as_str()
        .map(|s| s.to_string());

    // Broadcast
    let broadcast = competition["broadcasts"]
        .as_array()
        .and_then(|b| b.first())
        .and_then(|b| b["names"].as_array())
        .and_then(|names| names.first())
        .and_then(|n| n.as_str())
        .map(|s| s.to_string());

    // Playoff round from notes
    let playoff_round = competition["notes"]
        .as_array()
        .and_then(|notes| notes.first())
        .and_then(|note| note["headline"].as_str())
        .map(|s| s.to_string());

    // Status
    let status = &competition["status"];
    let status_name = status["type"]["name"].as_str().unwrap_or("STATUS_SCHEDULED");
    let state = match status_name {
        "STATUS_IN_PROGRESS" | "STATUS_HALFTIME" | "STATUS_END_PERIOD" => GameState::Live,
        "STATUS_FINAL" | "STATUS_FINAL_OT" => GameState::Final,
        "STATUS_POSTPONED" => GameState::Postponed,
        _ => GameState::Upcoming,
    };

    // Clock and period
    let clock = status["displayClock"].as_str().map(|s| s.to_string());
    let period = status["period"].as_i64().map(|p| p as i32);
    let period_label = status["type"]["shortDetail"]
        .as_str()
        .map(|s| s.to_string());

    // Teams
    let competitors = competition["competitors"].as_array()?;
    let mut home = None;
    let mut away = None;
    for comp in competitors {
        let team_data = parse_team(comp);
        if comp["homeAway"].as_str() == Some("home") {
            home = Some(team_data);
        } else {
            away = Some(team_data);
        }
    }

    // Leaders
    let leaders = parse_leaders(competition, league_id);

    // Situation (MLB base/out state)
    let situation = if league_id == "mlb" && state == GameState::Live {
        parse_mlb_situation(&competition["situation"])
    } else {
        None
    };

    Some(Game {
        id,
        league: league_id.to_string(),
        state,
        name,
        start_time,
        venue,
        broadcast,
        playoff_round,
        home: home?,
        away: away?,
        clock,
        period,
        period_label,
        leaders,
        situation,
    })
}

fn parse_team(competitor: &serde_json::Value) -> GameTeam {
    let team = &competitor["team"];
    let score_str = competitor["score"].as_str().unwrap_or("");
    let score = score_str.parse::<i32>().ok();
    let winner = competitor["winner"].as_bool();
    let record = competitor["records"]
        .as_array()
        .and_then(|r| r.first())
        .and_then(|r| r["summary"].as_str())
        .map(|s| s.to_string());

    GameTeam {
        id: team["id"].as_str().unwrap_or("").to_string(),
        name: team["shortDisplayName"]
            .as_str()
            .or_else(|| team["displayName"].as_str())
            .unwrap_or("")
            .to_string(),
        abbreviation: team["abbreviation"].as_str().unwrap_or("").to_string(),
        logo: team["logo"].as_str().unwrap_or("").to_string(),
        record,
        score,
        winner,
    }
}

fn parse_leaders(competition: &serde_json::Value, _league_id: &str) -> Vec<Leader> {
    let empty = vec![];
    let leaders_arr = competition["leaders"].as_array().unwrap_or(&empty);

    // ESPN returns leaders grouped by stat category.
    // We want the top leader from each category, up to 2 total.
    let mut result = Vec::new();
    for category in leaders_arr {
        if let Some(top) = category["leaders"].as_array().and_then(|l| l.first()) {
            let athlete = &top["athlete"];
            let name = athlete["shortName"]
                .as_str()
                .or_else(|| athlete["displayName"].as_str())
                .unwrap_or("")
                .to_string();

            let stat_value = top["displayValue"].as_str().unwrap_or("").to_string();
            let stat_name = category["shortDisplayName"]
                .as_str()
                .or_else(|| category["displayName"].as_str())
                .unwrap_or("")
                .to_string();

            // Determine which team this leader is on
            let team_id = athlete["team"]["id"].as_str().unwrap_or("");
            let home_id = competition["competitors"]
                .as_array()
                .and_then(|c| {
                    c.iter()
                        .find(|comp| comp["homeAway"].as_str() == Some("home"))
                })
                .and_then(|c| c["team"]["id"].as_str())
                .unwrap_or("");
            let team = if team_id == home_id {
                "home"
            } else {
                "away"
            };

            result.push(Leader {
                team: team.to_string(),
                name,
                stats: format!("{} {}", stat_value, stat_name),
            });
        }
        if result.len() >= 2 {
            break;
        }
    }
    result
}

fn parse_mlb_situation(situation: &serde_json::Value) -> Option<String> {
    if situation.is_null() {
        return None;
    }
    let outs = situation["outs"].as_i64().unwrap_or(0);
    let on_first = situation["onFirst"].as_bool().unwrap_or(false);
    let on_second = situation["onSecond"].as_bool().unwrap_or(false);
    let on_third = situation["onThird"].as_bool().unwrap_or(false);

    let mut runners = Vec::new();
    if on_first {
        runners.push("1st");
    }
    if on_second {
        runners.push("2nd");
    }
    if on_third {
        runners.push("3rd");
    }

    let outs_str = if outs == 1 {
        "1 out".to_string()
    } else {
        format!("{} outs", outs)
    };
    if runners.is_empty() {
        Some(outs_str)
    } else {
        Some(format!(
            "{} · Runner{} on {}",
            outs_str,
            if runners.len() > 1 { "s" } else { "" },
            runners.join(", ")
        ))
    }
}

/// Transform ESPN teams JSON into our TeamInfo types.
pub fn transform_teams(raw: &serde_json::Value, league_id: &str) -> Vec<TeamInfo> {
    let empty = vec![];
    let sports = raw["sports"].as_array().unwrap_or(&empty);
    let teams_arr = sports
        .first()
        .and_then(|s| s["leagues"].as_array())
        .and_then(|l| l.first())
        .and_then(|l| l["teams"].as_array())
        .unwrap_or(&empty);

    teams_arr
        .iter()
        .filter_map(|entry| {
            let team = &entry["team"];
            Some(TeamInfo {
                id: team["id"].as_str()?.to_string(),
                name: team["shortDisplayName"]
                    .as_str()
                    .or_else(|| team["displayName"].as_str())?
                    .to_string(),
                display_name: team["displayName"].as_str()?.to_string(),
                abbreviation: team["abbreviation"].as_str().unwrap_or("").to_string(),
                logo: team["logos"]
                    .as_array()
                    .and_then(|l| l.first())
                    .and_then(|l| l["href"].as_str())
                    .unwrap_or("")
                    .to_string(),
                league: league_id.to_string(),
            })
        })
        .collect()
}
```

- [ ] **Step 2: Export from mod.rs**

Add `pub mod transform;` to `backend/src/integrations/sports/mod.rs`.

- [ ] **Step 3: Add chrono dependency if not already present**

Run: `cd backend && cargo add chrono --features serde`

(chrono is already in Cargo.toml, so this is a no-op but safe to run.)

- [ ] **Step 4: Verify it compiles**

Run: `cd backend && cargo check`

- [ ] **Step 5: Commit**

```bash
git add backend/src/integrations/sports/
git commit -m "feat(sports): add ESPN response transformation layer"
```

---

### Task 4: In-memory cache

**Files:**
- Create: `backend/src/integrations/sports/cache.rs`
- Modify: `backend/src/integrations/sports/mod.rs`

- [ ] **Step 1: Create the cache module**

Create `backend/src/integrations/sports/cache.rs`:

```rust
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;

/// Cached ESPN response for a single league
#[derive(Clone)]
struct CacheEntry {
    data: serde_json::Value,
    fetched_at: Instant,
}

/// Thread-safe in-memory cache for ESPN scoreboard data, keyed by league.
#[derive(Clone)]
pub struct EspnCache {
    entries: Arc<RwLock<HashMap<String, CacheEntry>>>,
    live_flag: Arc<RwLock<bool>>,
}

impl EspnCache {
    pub fn new() -> Self {
        Self {
            entries: Arc::new(RwLock::new(HashMap::new())),
            live_flag: Arc::new(RwLock::new(false)),
        }
    }

    /// Get cached data if it exists and is fresher than `max_age_secs`.
    pub async fn get(&self, league: &str, max_age_secs: u64) -> Option<serde_json::Value> {
        let entries = self.entries.read().await;
        entries.get(league).and_then(|entry| {
            if entry.fetched_at.elapsed().as_secs() < max_age_secs {
                Some(entry.data.clone())
            } else {
                None
            }
        })
    }

    /// Get cached data regardless of age (for fallback on API errors).
    pub async fn get_stale(&self, league: &str) -> Option<serde_json::Value> {
        let entries = self.entries.read().await;
        entries.get(league).map(|entry| entry.data.clone())
    }

    /// Store data in the cache.
    pub async fn set(&self, key: &str, data: serde_json::Value) {
        let mut entries = self.entries.write().await;
        entries.insert(
            key.to_string(),
            CacheEntry {
                data,
                fetched_at: Instant::now(),
            },
        );
    }

    /// Get whether live games were detected on the last fetch.
    pub async fn has_live_flag(&self) -> bool {
        *self.live_flag.read().await
    }

    /// Set the live games flag.
    pub async fn set_live_flag(&self, has_live: bool) {
        *self.live_flag.write().await = has_live;
    }
}
```

- [ ] **Step 2: Export from mod.rs**

Add `pub mod cache;` to `backend/src/integrations/sports/mod.rs`.

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && cargo check`

- [ ] **Step 4: Commit**

```bash
git add backend/src/integrations/sports/
git commit -m "feat(sports): add in-memory ESPN response cache"
```

---

### Task 5: Route handlers and wiring

**Files:**
- Create: `backend/src/integrations/sports/routes.rs`
- Modify: `backend/src/integrations/sports/mod.rs`

- [ ] **Step 1: Create route handlers**

Create `backend/src/integrations/sports/routes.rs`:

```rust
use axum::Json;
use axum::extract::{Query, State};
use serde::Deserialize;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

use super::cache::EspnCache;
use super::types::*;
use super::{INTEGRATION_ID, espn, transform};

#[derive(Clone)]
pub struct SportsState {
    pub pool: sqlx::SqlitePool,
    pub cache: EspnCache,
    pub client: reqwest::Client,
}

/// GET /api/sports/games
pub async fn get_games(
    State(state): State<SportsState>,
) -> Result<Json<GamesResponse>, AppError> {
    let config = IntegrationConfig::new(&state.pool, INTEGRATION_ID);

    // Load tracked teams
    let tracked: Vec<TrackedTeam> = config
        .get_json_or("tracked_teams", vec![])
        .await?;

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

    // Determine which leagues we need to fetch
    let mut leagues_needed: Vec<(&str, &str, &str)> = Vec::new();
    for &(league_id, sport, league) in LEAGUES {
        if tracked.iter().any(|t| t.league == league_id) {
            leagues_needed.push((league_id, sport, league));
        }
    }

    let mut all_games: Vec<Game> = Vec::new();
    let mut any_live = false;

    // Check if previous response had live games to determine cache TTL.
    // If live games were present last time, use the shorter live interval.
    let had_live_previously = state.cache.has_live_flag().await;
    let max_age = if had_live_previously { poll_live } else { poll_idle };

    for (league_id, sport, league) in &leagues_needed {
        let tracked_ids: Vec<String> = tracked
            .iter()
            .filter(|t| t.league == *league_id)
            .map(|t| t.team_id.clone())
            .collect();

        let scoreboard = match state.cache.get(league_id, max_age).await {
            Some(cached) => cached,
            None => {
                // Fetch fresh data
                match espn::fetch_scoreboard(&state.client, sport, league).await {
                    Ok(data) => {
                        state.cache.set(league_id, data.clone()).await;
                        data
                    }
                    Err(e) => {
                        // Serve stale cache on error
                        tracing::warn!("ESPN fetch failed for {}, using stale cache: {}", league_id, e);
                        match state.cache.get_stale(league_id).await {
                            Some(stale) => stale,
                            None => {
                                tracing::error!("No cached data for {}", league_id);
                                continue;
                            }
                        }
                    }
                }
            }
        };

        let games = transform::transform_scoreboard(
            &scoreboard,
            league_id,
            &tracked_ids,
            window_hours,
        );

        for game in &games {
            if game.state == GameState::Live {
                any_live = true;
            }
        }
        all_games.extend(games);
    }

    // Store the live flag so next request knows which TTL to use
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

/// GET /api/sports/teams?league=nba
/// Team lists are cached for 24 hours since they rarely change.
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

/// GET /api/sports/teams/search?q=warriors
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

/// Fetch teams for a league, using a 24-hour cache.
async fn fetch_cached_teams(
    state: &SportsState,
    league_id: &str,
    sport: &str,
    league: &str,
) -> Result<Vec<TeamInfo>, AppError> {
    let cache_key = format!("teams_{}", league_id);
    // Cache team lists for 24 hours
    if let Some(cached) = state.cache.get(&cache_key, 86400).await {
        return Ok(transform::transform_teams(&cached, league_id));
    }
    let raw = espn::fetch_teams(&state.client, sport, league).await?;
    state.cache.set(&cache_key, raw.clone()).await;
    Ok(transform::transform_teams(&raw, league_id))
}
```

- [ ] **Step 2: Wire up the router in mod.rs**

Replace the contents of `backend/src/integrations/sports/mod.rs`:

```rust
pub mod cache;
pub mod espn;
pub mod routes;
pub mod transform;
pub mod types;

use axum::Router;
use sqlx::SqlitePool;

pub const INTEGRATION_ID: &str = "sports";

pub fn router(pool: SqlitePool) -> Router {
    let state = routes::SportsState {
        pool,
        cache: cache::EspnCache::new(),
        client: reqwest::Client::new(),
    };

    Router::new()
        .route("/games", axum::routing::get(routes::get_games))
        .route("/teams", axum::routing::get(routes::get_teams))
        .route("/teams/search", axum::routing::get(routes::search_teams))
        .with_state(state)
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && cargo check`

- [ ] **Step 4: Commit**

```bash
git add backend/src/integrations/sports/
git commit -m "feat(sports): add route handlers with caching and team search"
```

---

### Task 6: Backend tests

**Files:**
- Create: `backend/tests/sports_test.rs`

Note: Since the ESPN API is external, we test the transform and cache layers directly rather than the full route (which would require mocking HTTP). Route-level tests would need a mock ESPN server.

- [ ] **Step 1: Write transform tests**

Create `backend/tests/sports_test.rs`:

```rust
mod helpers;

use serde_json::json;

#[test]
fn test_transform_scoreboard_filters_tracked_teams() {
    let raw = json!({
        "events": [
            {
                "id": "1",
                "name": "Team A at Team B",
                "date": "2026-03-16T20:00:00Z",
                "competitions": [{
                    "competitors": [
                        {
                            "homeAway": "home",
                            "team": {"id": "10", "shortDisplayName": "Team B", "abbreviation": "TB", "logo": ""},
                            "score": "0",
                            "records": [{"summary": "10-5"}]
                        },
                        {
                            "homeAway": "away",
                            "team": {"id": "20", "shortDisplayName": "Team A", "abbreviation": "TA", "logo": ""},
                            "score": "0",
                            "records": [{"summary": "8-7"}]
                        }
                    ],
                    "status": {
                        "type": {"name": "STATUS_SCHEDULED", "shortDetail": "3/16 - 8:00 PM"},
                        "displayClock": "0:00",
                        "period": 0
                    },
                    "broadcasts": [],
                    "venue": {"fullName": "Arena"},
                    "leaders": [],
                    "notes": []
                }]
            },
            {
                "id": "2",
                "name": "Team C at Team D",
                "date": "2026-03-16T21:00:00Z",
                "competitions": [{
                    "competitors": [
                        {
                            "homeAway": "home",
                            "team": {"id": "30", "shortDisplayName": "Team D", "abbreviation": "TD", "logo": ""},
                            "score": "0",
                            "records": [{"summary": "12-3"}]
                        },
                        {
                            "homeAway": "away",
                            "team": {"id": "40", "shortDisplayName": "Team C", "abbreviation": "TC", "logo": ""},
                            "score": "0",
                            "records": [{"summary": "9-6"}]
                        }
                    ],
                    "status": {
                        "type": {"name": "STATUS_SCHEDULED", "shortDetail": "3/16 - 9:00 PM"},
                        "displayClock": "0:00",
                        "period": 0
                    },
                    "broadcasts": [],
                    "venue": {"fullName": "Stadium"},
                    "leaders": [],
                    "notes": []
                }]
            }
        ]
    });

    // Only tracking team 10 — should only get game 1
    let tracked = vec!["10".to_string()];
    let games = dashboard_backend::integrations::sports::transform::transform_scoreboard(
        &raw, "nba", &tracked, 48.0,
    );
    assert_eq!(games.len(), 1);
    assert_eq!(games[0].id, "1");
    assert_eq!(games[0].home.id, "10");
}

#[test]
fn test_transform_game_states() {
    let make_event = |id: &str, status_name: &str| {
        json!({
            "id": id,
            "name": "Game",
            "date": "2026-03-16T20:00:00Z",
            "competitions": [{
                "competitors": [
                    {
                        "homeAway": "home",
                        "team": {"id": "1", "shortDisplayName": "Home", "abbreviation": "HM", "logo": ""},
                        "score": "100",
                        "records": [{"summary": "10-5"}]
                    },
                    {
                        "homeAway": "away",
                        "team": {"id": "2", "shortDisplayName": "Away", "abbreviation": "AW", "logo": ""},
                        "score": "95",
                        "records": [{"summary": "8-7"}]
                    }
                ],
                "status": {
                    "type": {"name": status_name, "shortDetail": "Detail"},
                    "displayClock": "4:22",
                    "period": 3
                },
                "broadcasts": [],
                "venue": {"fullName": "Arena"},
                "leaders": [],
                "notes": []
            }]
        })
    };

    let raw = json!({
        "events": [
            make_event("1", "STATUS_IN_PROGRESS"),
            make_event("2", "STATUS_FINAL"),
            make_event("3", "STATUS_SCHEDULED"),
            make_event("4", "STATUS_POSTPONED"),
            make_event("5", "STATUS_HALFTIME"),
        ]
    });

    let tracked = vec!["1".to_string(), "2".to_string()];
    let games = dashboard_backend::integrations::sports::transform::transform_scoreboard(
        &raw, "nba", &tracked, 48.0,
    );

    use dashboard_backend::integrations::sports::types::GameState;
    let states: Vec<&GameState> = games.iter().map(|g| &g.state).collect();
    assert!(states.contains(&&GameState::Live)); // STATUS_IN_PROGRESS
    assert!(states.contains(&&GameState::Final)); // STATUS_FINAL
}

#[test]
fn test_transform_teams() {
    let raw = json!({
        "sports": [{
            "leagues": [{
                "teams": [
                    {
                        "team": {
                            "id": "9",
                            "shortDisplayName": "Warriors",
                            "displayName": "Golden State Warriors",
                            "abbreviation": "GSW",
                            "logos": [{"href": "https://example.com/gs.png"}]
                        }
                    },
                    {
                        "team": {
                            "id": "13",
                            "shortDisplayName": "Lakers",
                            "displayName": "Los Angeles Lakers",
                            "abbreviation": "LAL",
                            "logos": [{"href": "https://example.com/lal.png"}]
                        }
                    }
                ]
            }]
        }]
    });

    let teams = dashboard_backend::integrations::sports::transform::transform_teams(&raw, "nba");
    assert_eq!(teams.len(), 2);
    assert_eq!(teams[0].name, "Warriors");
    assert_eq!(teams[0].league, "nba");
    assert_eq!(teams[1].abbreviation, "LAL");
}

#[tokio::test]
async fn test_cache_ttl() {
    let cache = dashboard_backend::integrations::sports::cache::EspnCache::new();
    let data = json!({"test": true});

    cache.set("nba", data.clone()).await;

    // Should be available with generous TTL
    assert!(cache.get("nba", 60).await.is_some());

    // Should not be available with 0 TTL
    assert!(cache.get("nba", 0).await.is_none());

    // Stale should always work
    assert!(cache.get_stale("nba").await.is_some());

    // Non-existent league
    assert!(cache.get("xyz", 60).await.is_none());
    assert!(cache.get_stale("xyz").await.is_none());
}
```

- [ ] **Step 2: Run the tests**

Run: `cd backend && cargo test -- sports`
Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add backend/tests/sports_test.rs
git commit -m "test(sports): add transform and cache unit tests"
```

---

## Chunk 2: Frontend

### Task 7: Frontend types, config, and hook

**Files:**
- Create: `frontend/src/integrations/sports/types.ts`
- Create: `frontend/src/integrations/sports/config.ts`
- Create: `frontend/src/integrations/sports/useSportsGames.ts`
- Create: `frontend/src/integrations/sports/index.ts`

- [ ] **Step 1: Create TypeScript types**

Create `frontend/src/integrations/sports/types.ts`:

```typescript
export interface GameTeam {
  id: string
  name: string
  abbreviation: string
  logo: string
  record: string | null
  score: number | null
  winner: boolean | null
}

export interface Leader {
  team: 'home' | 'away'
  name: string
  stats: string
}

export type GameState = 'live' | 'final' | 'upcoming' | 'postponed'

export interface Game {
  id: string
  league: string
  state: GameState
  name: string
  startTime: string
  venue: string | null
  broadcast: string | null
  playoffRound: string | null
  home: GameTeam
  away: GameTeam
  clock: string | null
  period: number | null
  periodLabel: string | null
  leaders: Leader[]
  situation: string | null
}

export interface GamesResponse {
  games: Game[]
  hasLive: boolean
}

export interface TeamInfo {
  id: string
  name: string
  displayName: string
  abbreviation: string
  logo: string
  league: string
}

export interface TeamsResponse {
  teams: TeamInfo[]
}

export interface TrackedTeam {
  league: string
  teamId: string
}
```

- [ ] **Step 2: Create the integration config**

Create `frontend/src/integrations/sports/config.ts`:

```typescript
import { z } from 'zod'
import { defineIntegration } from '../define-integration'
import { SportsSettings } from './SportsSettings'

export const sportsIntegration = defineIntegration({
  id: 'sports',
  name: 'Sports',
  schema: z.object({
    tracked_teams: z.string().optional().default('[]'),
    poll_interval_live: z.string().optional().default('30'),
    poll_interval_idle: z.string().optional().default('900'),
    window_hours: z.string().optional().default('24'),
  }),
  fields: {
    tracked_teams: { label: 'Tracked Teams', description: 'JSON array of tracked teams' },
    poll_interval_live: { label: 'Live Poll Interval (seconds)', description: 'How often to refresh during live games' },
    poll_interval_idle: { label: 'Idle Poll Interval (seconds)', description: 'How often to refresh when no live games' },
    window_hours: { label: 'Time Window (hours)', description: 'How far back/forward to show games' },
  },
  settingsComponent: SportsSettings,
})
```

- [ ] **Step 3: Create the data-fetching hook**

Create `frontend/src/integrations/sports/useSportsGames.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import { sportsIntegration } from './config'
import type { GamesResponse } from './types'

export function useSportsGames() {
  const query = useQuery({
    queryKey: ['sports', 'games'],
    queryFn: () => sportsIntegration.api.get<GamesResponse>('/games'),
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.hasLive) {
        return 30 * 1000 // 30 seconds for live games
      }
      return 15 * 60 * 1000 // 15 minutes idle
    },
  })

  return query
}
```

- [ ] **Step 4: Create barrel export**

Create `frontend/src/integrations/sports/index.ts`:

```typescript
export { SportsWidget } from './SportsWidget'
export { sportsIntegration } from './config'
```

Note: `SportsWidget` and `SportsSettings` don't exist yet — they'll be created in the next tasks. The config import of `SportsSettings` will also need the file to exist. Create a placeholder:

Create `frontend/src/integrations/sports/SportsSettings.tsx`:
```typescript
export function SportsSettings() {
  return <div>Sports settings placeholder</div>
}
```

Create `frontend/src/integrations/sports/SportsWidget.tsx`:
```typescript
export function SportsWidget() {
  return <div>Sports widget placeholder</div>
}
```

- [ ] **Step 5: Register in the integration registry**

In `frontend/src/integrations/registry.ts`, add the import and entry:
```typescript
import { sportsIntegration } from './sports/config'
```
Add `sportsIntegration` to the `integrations` array.

- [ ] **Step 6: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add frontend/src/integrations/sports/ frontend/src/integrations/registry.ts
git commit -m "feat(sports): add frontend types, config, and data hook"
```

---

### Task 8: Theme and WidgetCard integration

**Files:**
- Modify: `frontend/src/theme/variables.css`
- Modify: `frontend/src/ui/WidgetCard.tsx`

- [ ] **Step 1: Add sports color to theme**

In `frontend/src/theme/variables.css`, in the `@theme` block that contains `--color-calendar`, `--color-chores`, etc., add:

```css
--color-sports: #c04040;
```

- [ ] **Step 2: Add sports category to WidgetCard**

In `frontend/src/ui/WidgetCard.tsx`:

Update the `CardCategory` type to include `'sports'`:
```typescript
type CardCategory = 'calendar' | 'chores' | 'info' | 'food' | 'grocery' | 'sports'
```

Add to `categoryColors`:
```typescript
sports: 'var(--color-sports)',
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/theme/variables.css frontend/src/ui/WidgetCard.tsx
git commit -m "feat(sports): add sports theme color and widget card category"
```

---

### Task 9: GameCard component

**Files:**
- Create: `frontend/src/integrations/sports/GameCard.tsx`

- [ ] **Step 1: Create the game card component**

Create `frontend/src/integrations/sports/GameCard.tsx`:

```typescript
import type { Game } from './types'

function formatRelativeTime(startTime: string): string {
  const start = new Date(startTime)
  const now = new Date()
  const diffHours = (now.getTime() - start.getTime()) / (1000 * 60 * 60)

  if (diffHours < 1) return 'Just now'
  if (diffHours < 12) return `${Math.round(diffHours)}h ago`
  if (diffHours < 24) return 'Earlier today'
  return 'Yesterday'
}

function formatUpcomingTime(startTime: string): string {
  const start = new Date(startTime)
  const now = new Date()
  const diffHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60)

  const timeStr = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  if (diffHours < 0) return timeStr
  if (diffHours < 12) return `Today ${timeStr}`

  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (start.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow ${timeStr}`
  }

  return `${start.toLocaleDateString([], { weekday: 'short' })} ${timeStr}`
}

export function GameCard({ game }: { game: Game }) {
  const isLive = game.state === 'live'
  const isFinal = game.state === 'final'
  const isPostponed = game.state === 'postponed'

  return (
    <div
      className={`py-[10px] border-b border-[#f0ece6] last:border-b-0 ${
        isLive ? 'bg-[rgba(229,57,53,0.03)] rounded-[10px] px-[10px] -mx-[10px]' : ''
      }`}
    >
      {/* League label */}
      <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.3px] mb-[6px]">
        {game.league.toUpperCase()}
        {isFinal && ` · ${formatRelativeTime(game.startTime)}`}
      </div>

      {/* Matchup row */}
      <div className="flex items-center gap-[10px]">
        {/* Away team (left) */}
        <div className="flex items-center gap-2 flex-1">
          <img
            src={game.away.logo}
            alt={game.away.abbreviation}
            className="w-9 h-9 object-contain"
          />
          <div>
            <div className={`text-[15px] font-semibold ${
              isFinal && game.away.winner === false ? 'text-[#c0b8ae]' : 'text-text-primary'
            }`}>
              {game.away.name}
            </div>
            {game.away.record && (
              <div className="text-[11px] text-text-muted">{game.away.record}</div>
            )}
          </div>
        </div>

        {/* Center block */}
        <div className="text-center min-w-[70px]">
          {(isLive || isFinal) && game.away.score != null && game.home.score != null && (
            <div className="text-[24px] font-bold tracking-[2px]">
              <span className={game.away.winner === false ? 'text-[#c0b8ae]' : 'text-text-primary'}>
                {game.away.score}
              </span>
              <span className="text-[#d0c8c0] mx-[2px]">-</span>
              <span className={game.home.winner === false ? 'text-[#c0b8ae]' : 'text-text-primary'}>
                {game.home.score}
              </span>
            </div>
          )}

          {isLive && (
            <>
              <div className="inline-flex items-center gap-1 text-[10px] font-bold text-error uppercase">
                <span className="w-[6px] h-[6px] rounded-full bg-error animate-pulse" />
                LIVE
              </div>
              {game.periodLabel && (
                <div className="text-[13px] font-semibold text-text-primary mt-[2px]">
                  {game.periodLabel}
                </div>
              )}
            </>
          )}

          {isFinal && (
            <div className="text-[11px] font-semibold text-success uppercase">Final</div>
          )}

          {game.state === 'upcoming' && (
            <>
              <div className="text-[13px] font-semibold text-calendar">
                {formatUpcomingTime(game.startTime)}
              </div>
              {game.broadcast && (
                <div className="text-[10px] text-text-muted mt-[1px]">{game.broadcast}</div>
              )}
            </>
          )}

          {isPostponed && (
            <div className="text-[13px] font-semibold text-error">Postponed</div>
          )}
        </div>

        {/* Home team (right) */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          <div className="text-right">
            <div className={`text-[15px] font-semibold ${
              isFinal && game.home.winner === false ? 'text-[#c0b8ae]' : 'text-text-primary'
            }`}>
              {game.home.name}
            </div>
            {game.home.record && (
              <div className="text-[11px] text-text-muted">{game.home.record}</div>
            )}
          </div>
          <img
            src={game.home.logo}
            alt={game.home.abbreviation}
            className="w-9 h-9 object-contain"
          />
        </div>
      </div>

      {/* Stats / situation */}
      {(isLive || isFinal) && game.leaders.length > 0 && (
        <div className="mt-[6px] pt-[6px] border-t border-[#f5f2ed]">
          {game.leaders.map((leader, i) => (
            <div key={i} className="text-[11px] text-text-muted flex items-center gap-1">
              <span className="font-medium text-text-secondary">{leader.name}:</span>
              {leader.stats}
            </div>
          ))}
          {isLive && game.situation && (
            <div className="text-[11px] text-text-muted mt-[2px]">{game.situation}</div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/integrations/sports/GameCard.tsx
git commit -m "feat(sports): add GameCard component for individual game rendering"
```

---

### Task 10: SportsWidget component

**Files:**
- Modify: `frontend/src/integrations/sports/SportsWidget.tsx`
- Modify: `frontend/src/boards/HomeBoard.tsx`

- [ ] **Step 1: Implement the SportsWidget**

Replace `frontend/src/integrations/sports/SportsWidget.tsx`:

```typescript
import { WidgetCard } from '@/ui/WidgetCard'
import { LoadingSpinner } from '@/ui/LoadingSpinner'
import { useSportsGames } from './useSportsGames'
import { GameCard } from './GameCard'

export function SportsWidget() {
  const { data, isLoading, error, refetch } = useSportsGames()

  const games = data?.games ?? []
  const liveCount = games.filter((g) => g.state === 'live').length

  if (isLoading && games.length === 0) {
    return (
      <WidgetCard title="Sports" category="sports">
        <LoadingSpinner />
      </WidgetCard>
    )
  }

  if (error && games.length === 0) {
    return (
      <WidgetCard title="Sports" category="sports">
        <div className="text-[13px] text-text-muted">
          Unable to load scores
          <button
            onClick={() => refetch()}
            className="ml-2 text-sports underline"
          >
            Retry
          </button>
        </div>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard
      title="Sports"
      category="sports"
      badge={liveCount > 0 ? `${liveCount} Live` : undefined}
    >
      {games.length === 0 ? (
        <div className="text-[13px] text-text-muted py-1">
          {data ? 'No games today' : 'Select teams in Settings to get started'}
        </div>
      ) : (
        <div className="flex flex-col">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </WidgetCard>
  )
}
```

- [ ] **Step 2: Replace the placeholder in HomeBoard**

In `frontend/src/boards/HomeBoard.tsx`:

Add the import:
```typescript
import { SportsWidget } from '@/integrations/sports'
```

Replace the sports placeholder block:
```typescript
{/* Sports -- col 4, row 1 */}
<WidgetCard title="Sports" category="info">
  <div className="text-text-muted text-sm">Sports placeholder</div>
</WidgetCard>
```

With:
```typescript
{/* Sports -- col 4, row 1 */}
<SportsWidget />
```

Remove the `WidgetCard` import if it's no longer used directly in HomeBoard (check — it's likely still used by the Grocery placeholder).

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/integrations/sports/SportsWidget.tsx frontend/src/boards/HomeBoard.tsx
git commit -m "feat(sports): add SportsWidget and wire into HomeBoard"
```

---

### Task 11: SportsSettings component

**Files:**
- Modify: `frontend/src/integrations/sports/SportsSettings.tsx`

- [ ] **Step 1: Implement the full settings component**

Replace `frontend/src/integrations/sports/SportsSettings.tsx`:

```typescript
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/ui/Button'
import { sportsIntegration } from './config'
import type { TeamInfo, TrackedTeam } from './types'

const LEAGUES = [
  { id: 'nba', name: 'NBA' },
  { id: 'nfl', name: 'NFL' },
  { id: 'mlb', name: 'MLB' },
  { id: 'nhl', name: 'NHL' },
]

export function SportsSettings() {
  const [trackedTeams, setTrackedTeams] = useState<TrackedTeam[]>([])
  const [leagueTeams, setLeagueTeams] = useState<Record<string, TeamInfo[]>>({})
  const [expandedLeague, setExpandedLeague] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TeamInfo[]>([])
  const [searching, setSearching] = useState(false)
  const [pollLive, setPollLive] = useState('30')
  const [pollIdle, setPollIdle] = useState('900')
  const [windowHours, setWindowHours] = useState('24')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const config = await fetch('/api/config').then((r) => r.json()) as Record<string, string>
      const tracked = config['sports.tracked_teams']
      setTrackedTeams(tracked ? JSON.parse(tracked) : [])
      setPollLive(config['sports.poll_interval_live'] ?? '30')
      setPollIdle(config['sports.poll_interval_idle'] ?? '900')
      setWindowHours(config['sports.window_hours'] ?? '24')
    } catch {
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const loadLeagueTeams = async (leagueId: string) => {
    if (leagueTeams[leagueId]) return // already loaded
    try {
      const data = await sportsIntegration.api.get<{ teams: TeamInfo[] }>(
        `/teams?league=${leagueId}`,
      )
      setLeagueTeams((prev) => ({ ...prev, [leagueId]: data.teams }))
    } catch {
      setError(`Failed to load ${leagueId.toUpperCase()} teams`)
    }
  }

  const toggleLeague = (leagueId: string) => {
    if (expandedLeague === leagueId) {
      setExpandedLeague(null)
    } else {
      setExpandedLeague(leagueId)
      loadLeagueTeams(leagueId)
    }
  }

  const isTracked = (league: string, teamId: string) =>
    trackedTeams.some((t) => t.league === league && t.teamId === teamId)

  const toggleTeam = (league: string, teamId: string) => {
    setTrackedTeams((prev) => {
      if (isTracked(league, teamId)) {
        return prev.filter((t) => !(t.league === league && t.teamId === teamId))
      }
      return [...prev, { league, teamId }]
    })
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const data = await sportsIntegration.api.get<{ teams: TeamInfo[] }>(
        `/teams/search?q=${encodeURIComponent(query)}`,
      )
      setSearchResults(data.teams)
    } catch {
      // Silently fail search
    } finally {
      setSearching(false)
    }
  }

  const handleSave = async () => {
    try {
      setError(null)
      const saves = [
        ['sports.tracked_teams', JSON.stringify(trackedTeams)],
        ['sports.poll_interval_live', pollLive],
        ['sports.poll_interval_idle', pollIdle],
        ['sports.window_hours', windowHours],
      ]
      for (const [key, value] of saves) {
        await fetch(`/api/config/${encodeURIComponent(key)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
        })
      }
      setStatus('Saved!')
      setTimeout(() => setStatus(null), 2000)
    } catch {
      setError('Failed to save settings')
    }
  }

  if (loading) {
    return <div className="text-text-muted text-sm">Loading...</div>
  }

  // Get team info for tracked teams (from loaded league data)
  const trackedWithInfo = trackedTeams.map((t) => {
    const team = leagueTeams[t.league]?.find((lt) => lt.id === t.teamId)
    return { ...t, info: team }
  })

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-error/10 text-error rounded-lg p-3 text-sm">{error}</div>
      )}

      {/* Tracked teams summary */}
      {trackedTeams.length > 0 && (
        <div>
          <label className="text-xs text-text-muted block mb-2">Tracked Teams</label>
          <div className="flex flex-wrap gap-2">
            {trackedWithInfo.map((t) => (
              <span
                key={`${t.league}-${t.teamId}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sports/10 text-sports text-sm font-medium"
              >
                {t.info && (
                  <img src={t.info.logo} alt="" className="w-4 h-4 object-contain" />
                )}
                {t.info?.name ?? t.teamId}
                <button
                  onClick={() => toggleTeam(t.league, t.teamId)}
                  className="ml-1 text-sports/60 hover:text-sports"
                >
                  x
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div>
        <label className="text-xs text-text-muted block mb-1">Search Teams</label>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by team name..."
          className="w-full px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
        />
        {searching && <div className="text-xs text-text-muted mt-1">Searching...</div>}
        {searchResults.length > 0 && (
          <div className="mt-2 border border-border rounded-lg overflow-hidden">
            {searchResults.map((team) => (
              <label
                key={`${team.league}-${team.id}`}
                className="flex items-center gap-3 p-2.5 hover:bg-bg-card-hover cursor-pointer border-b border-border last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={isTracked(team.league, team.id)}
                  onChange={() => toggleTeam(team.league, team.id)}
                  className="w-4 h-4 accent-sports"
                />
                <img src={team.logo} alt="" className="w-6 h-6 object-contain" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-text-primary">{team.displayName}</div>
                  <div className="text-xs text-text-muted">{team.league.toUpperCase()}</div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Per-league browsing */}
      <div>
        <label className="text-xs text-text-muted block mb-2">Browse by League</label>
        <div className="space-y-1">
          {LEAGUES.map((league) => (
            <div key={league.id} className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleLeague(league.id)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-text-primary hover:bg-bg-card-hover"
              >
                {league.name}
                <span className="text-text-muted text-xs">
                  {trackedTeams.filter((t) => t.league === league.id).length} tracked
                  {' · '}
                  {expandedLeague === league.id ? 'collapse' : 'expand'}
                </span>
              </button>
              {expandedLeague === league.id && (
                <div className="border-t border-border max-h-[300px] overflow-y-auto">
                  {!leagueTeams[league.id] ? (
                    <div className="p-3 text-xs text-text-muted">Loading teams...</div>
                  ) : (
                    leagueTeams[league.id].map((team) => (
                      <label
                        key={team.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-bg-card-hover cursor-pointer border-b border-border last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={isTracked(league.id, team.id)}
                          onChange={() => toggleTeam(league.id, team.id)}
                          className="w-4 h-4 accent-sports"
                        />
                        <img src={team.logo} alt="" className="w-6 h-6 object-contain" />
                        <span className="text-sm text-text-primary">{team.displayName}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Polling config */}
      <div>
        <label className="text-xs text-text-muted block mb-2">Polling Intervals</label>
        <div className="flex gap-4">
          <div>
            <label className="text-xs text-text-muted block mb-1">Live (seconds)</label>
            <input
              type="number"
              value={pollLive}
              onChange={(e) => setPollLive(e.target.value)}
              className="w-24 px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Idle (seconds)</label>
            <input
              type="number"
              value={pollIdle}
              onChange={(e) => setPollIdle(e.target.value)}
              className="w-24 px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Window (hours)</label>
            <input
              type="number"
              value={windowHours}
              onChange={(e) => setWindowHours(e.target.value)}
              className="w-24 px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave}>Save</Button>
        {status && <span className="text-sm text-success">{status}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/integrations/sports/SportsSettings.tsx
git commit -m "feat(sports): add SportsSettings with team search and league browser"
```

---

### Task 12: End-to-end smoke test

- [ ] **Step 1: Run backend tests**

Run: `cd backend && cargo test`
Expected: all tests pass

- [ ] **Step 2: Run frontend type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Start backend and verify endpoints**

Run: `cd backend && cargo run &`

Test the teams endpoint:
```bash
curl -s http://localhost:3042/api/sports/teams?league=nba | head -c 500
```
Expected: JSON with team objects

Test search:
```bash
curl -s "http://localhost:3042/api/sports/teams/search?q=warriors" | head -c 500
```
Expected: JSON with Warriors team

Test games (will be empty without tracked teams):
```bash
curl -s http://localhost:3042/api/sports/games
```
Expected: `{"games":[],"hasLive":false}`

- [ ] **Step 4: Start frontend and verify widget renders**

Run: `cd frontend && npm run dev &`

Open in browser — sports widget should show "Select teams in Settings to get started".

Navigate to Settings → Sports. Should see search bar, league browser, and polling config.

- [ ] **Step 5: Configure tracked teams and verify games appear**

In Settings, search for a team (e.g. "Lakers") and check the box. Save. Navigate back to home. The sports widget should now show games for that team (if any are in the current window).

- [ ] **Step 6: Commit any fixes needed**

```bash
git add -A
git commit -m "feat(sports): complete sports integration v1"
```

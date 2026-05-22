# MLB Live Game Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a rich live MLB game card on the kitchen dashboard — diamond + B/S/O + matchup with stats + win probability + current at-bat pitches + recent plays + game leaders — sourced from ESPN's `/summary?event=<id>` endpoint, embedded into the existing `/api/sports/games` response with tiered caching.

**Architecture:** One frontend endpoint (`/api/sports/games`), backend transparently calls ESPN `/summary` for any live game and embeds `live_detail` per game. Two cache tiers in `cache.rs`: scoreboard at 30 s TTL (existing), per-game summary at 5 s TTL (new). Frontend bumps sports widget to `xlarge` whenever a tracked team has a live game; `GameCardExpanded` becomes a state router that swaps the AI preview for a new `MlbLiveCard` during live games. `MlbSituation`'s diamond and B/S/O sub-components get extracted into reusable primitives and the compact-card MlbSituation goes away.

**Tech Stack:** Rust (axum, sqlx, reqwest, chrono, serde_json), TypeScript + React + Tailwind v4, ESPN public APIs (`site.api.espn.com`).

**Spec:** `docs/specs/2026-05-22-mlb-live-game-card-design.md`

---

## Task 1: Capture ESPN summary fixture

**Files:**
- Create: `backend/tests/fixtures/mlb_summary_sample.json`

- [ ] **Step 1: Pick a current MLB game ID**

Hit the scoreboard, copy a live or recent game ID:

```bash
curl -s 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard' | jq -r '.events[0].id'
```

Expected: a numeric string like `401472140`.

- [ ] **Step 2: Save the summary response**

```bash
mkdir -p backend/tests/fixtures
curl -s "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=<GAME_ID>" > backend/tests/fixtures/mlb_summary_sample.json
```

Expected: file written, ~50–200 KB JSON. Confirm with `wc -c backend/tests/fixtures/mlb_summary_sample.json`.

- [ ] **Step 3: Skim the shape**

```bash
jq 'keys' backend/tests/fixtures/mlb_summary_sample.json
jq '.boxscore | keys' backend/tests/fixtures/mlb_summary_sample.json
jq '.plays | length' backend/tests/fixtures/mlb_summary_sample.json
jq '.winprobability' backend/tests/fixtures/mlb_summary_sample.json | head -20
jq '.atBats' backend/tests/fixtures/mlb_summary_sample.json | head -20
jq '.leaders' backend/tests/fixtures/mlb_summary_sample.json | head -40
```

Note any keys that differ from the assumptions in this plan; later transform code is written against the keys below, so if ESPN's payload uses different names, adjust on the fly.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/fixtures/mlb_summary_sample.json
git commit -m "test: add ESPN MLB summary fixture for live-card development"
```

---

## Task 2: Define backend types

**Files:**
- Modify: `backend/src/integrations/sports/types.rs`

- [ ] **Step 1: Add live-detail types**

Append the following to `backend/src/integrations/sports/types.rs`:

```rust
#[derive(Debug, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WinProbability {
    pub home: f32,
    pub away: f32,
}

#[derive(Debug, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PitcherInfo {
    pub id: String,
    pub name: String,
    pub headshot_url: Option<String>,
    pub hand: Option<String>,
    pub era: Option<String>,
    pub pitches_today: Option<u32>,
    pub record: Option<String>,
}

#[derive(Debug, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BatterInfo {
    pub id: String,
    pub name: String,
    pub headshot_url: Option<String>,
    pub hand: Option<String>,
    pub avg: Option<String>,
    pub hr: Option<u32>,
    pub rbi: Option<u32>,
    pub today_line: Option<String>,
}

#[derive(Debug, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Matchup {
    pub pitcher: PitcherInfo,
    pub batter: BatterInfo,
}

#[derive(Debug, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Pitch {
    pub kind: String,          // "ball" | "called_strike" | "swinging_strike" | "foul" | "in_play"
    pub speed_mph: Option<u32>,
    pub pitch_type: Option<String>,
}

#[derive(Debug, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Play {
    pub id: String,
    pub text: String,
    pub inning_half: Option<String>,
    pub inning_number: Option<u32>,
    pub scoring: bool,
}

#[derive(Debug, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Leader {
    pub category: String,      // "Hitting" | "Pitching"
    pub player_name: String,
    pub display_value: String,
}

#[derive(Debug, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GameLeaders {
    pub home: Vec<Leader>,
    pub away: Vec<Leader>,
}

#[derive(Debug, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MlbLiveDetail {
    pub matchup: Option<Matchup>,
    pub pitch_sequence: Vec<Pitch>,
    pub recent_plays: Vec<Play>,
    pub leaders: GameLeaders,
}

#[derive(Debug, serde::Serialize, Clone)]
#[serde(tag = "sport", rename_all = "lowercase")]
pub enum SportSpecificLive {
    Mlb(MlbLiveDetail),
    // Nba(NbaLiveDetail) — future
}

#[derive(Debug, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LiveGameDetail {
    pub win_probability: Option<WinProbability>,
    #[serde(flatten)]
    pub sport_specific: SportSpecificLive,
}
```

- [ ] **Step 2: Add `live_detail` to Game**

Find the `Game` struct in `types.rs` and add the field:

```rust
pub struct Game {
    // ... existing fields ...
    pub live_detail: Option<LiveGameDetail>,
}
```

- [ ] **Step 3: Build**

```bash
cd backend && cargo build
```

Expected: existing call sites that construct `Game` will now fail to compile (missing field). Fix each one by appending `live_detail: None,` to its struct literal. The compiler errors point to every site.

- [ ] **Step 4: Re-build until clean**

```bash
cargo build
```

Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add backend/src/integrations/sports/types.rs $(grep -rl "Game {" backend/src/integrations/sports/)
git commit -m "feat(sports): add LiveGameDetail types and live_detail field"
```

---

## Task 3: Add ESPN summary fetch

**Files:**
- Modify: `backend/src/integrations/sports/espn.rs`

- [ ] **Step 1: Add the fetch function**

Open `backend/src/integrations/sports/espn.rs` and add below the existing `fetch_scoreboard`:

```rust
pub async fn fetch_summary(
    client: &reqwest::Client,
    sport: &str,
    league: &str,
    event_id: &str,
) -> Result<serde_json::Value, reqwest::Error> {
    let url = format!(
        "{}/{}/{}/summary?event={}",
        ESPN_BASE, sport, league, event_id
    );
    client.get(&url).send().await?.json().await
}
```

- [ ] **Step 2: Build**

```bash
cargo build
```

Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add backend/src/integrations/sports/espn.rs
git commit -m "feat(sports): add ESPN /summary fetch helper"
```

---

## Task 4: Parse summary → LiveGameDetail (TDD)

**Files:**
- Modify: `backend/src/integrations/sports/transform.rs`
- Test: `backend/tests/sports_test.rs`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/sports_test.rs`:

```rust
mod helpers;

use serde_json::json;
use dashboard_backend::integrations::sports::transform::parse_summary_to_live_detail;

#[test]
fn parse_summary_returns_some_for_sample_fixture() {
    let raw = include_str!("fixtures/mlb_summary_sample.json");
    let value: serde_json::Value = serde_json::from_str(raw).expect("fixture parses");
    let detail = parse_summary_to_live_detail(&value);
    assert!(detail.is_some(), "expected a LiveGameDetail from the sample summary");
}

#[test]
fn parse_summary_returns_none_for_empty_object() {
    let detail = parse_summary_to_live_detail(&json!({}));
    assert!(detail.is_none());
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cargo test -p dashboard-backend --test sports_test parse_summary -- --nocapture
```

Expected: compile error — `parse_summary_to_live_detail` doesn't exist yet.

- [ ] **Step 3: Add the transform**

Append to `backend/src/integrations/sports/transform.rs`:

```rust
use super::types::{
    BatterInfo, GameLeaders, Leader, LiveGameDetail, Matchup, MlbLiveDetail, Pitch, PitcherInfo,
    Play, SportSpecificLive, WinProbability,
};

pub fn parse_summary_to_live_detail(summary: &serde_json::Value) -> Option<LiveGameDetail> {
    // Bail if the payload doesn't look like a real summary (e.g. error response)
    if !summary.is_object() || summary.get("header").is_none() {
        return None;
    }

    Some(LiveGameDetail {
        win_probability: parse_win_probability(summary),
        sport_specific: SportSpecificLive::Mlb(MlbLiveDetail {
            matchup: parse_matchup(summary),
            pitch_sequence: parse_pitch_sequence(summary),
            recent_plays: parse_recent_plays(summary, 5),
            leaders: parse_leaders(summary),
        }),
    })
}

fn parse_win_probability(summary: &serde_json::Value) -> Option<WinProbability> {
    let wp = summary["winprobability"].as_array()?.last()?;
    Some(WinProbability {
        home: wp["homeWinPercentage"].as_f64().unwrap_or(0.0) as f32,
        away: 1.0 - wp["homeWinPercentage"].as_f64().unwrap_or(0.0) as f32,
    })
}

fn parse_matchup(summary: &serde_json::Value) -> Option<Matchup> {
    let situation = summary["situation"].as_object()?;
    let pitcher_raw = situation.get("pitcher")?;
    let batter_raw = situation.get("batter")?;

    Some(Matchup {
        pitcher: extract_pitcher_info(pitcher_raw),
        batter: extract_batter_info(batter_raw),
    })
}

fn extract_pitcher_info(node: &serde_json::Value) -> PitcherInfo {
    let athlete = &node["athlete"];
    let id = athlete["id"].as_str().unwrap_or("").to_string();
    PitcherInfo {
        headshot_url: if id.is_empty() {
            None
        } else {
            Some(format!(
                "https://a.espncdn.com/i/headshots/mlb/players/full/{}.png",
                id
            ))
        },
        id,
        name: athlete["displayName"].as_str().unwrap_or("").to_string(),
        hand: athlete["hand"]["abbreviation"].as_str().map(String::from),
        era: node["summary"].as_str().map(String::from),
        pitches_today: node["pitchesThrown"].as_u64().map(|n| n as u32),
        record: athlete["record"].as_str().map(String::from),
    }
}

fn extract_batter_info(node: &serde_json::Value) -> BatterInfo {
    let athlete = &node["athlete"];
    let id = athlete["id"].as_str().unwrap_or("").to_string();
    BatterInfo {
        headshot_url: if id.is_empty() {
            None
        } else {
            Some(format!(
                "https://a.espncdn.com/i/headshots/mlb/players/full/{}.png",
                id
            ))
        },
        id,
        name: athlete["displayName"].as_str().unwrap_or("").to_string(),
        hand: athlete["batsAndThrows"].as_str().map(String::from),
        avg: node["summary"].as_str().map(String::from),
        hr: node["statistics"][1]["displayValue"]
            .as_str()
            .and_then(|s| s.parse::<u32>().ok()),
        rbi: node["statistics"][2]["displayValue"]
            .as_str()
            .and_then(|s| s.parse::<u32>().ok()),
        today_line: node["statistics"][0]["displayValue"]
            .as_str()
            .map(String::from),
    }
}

fn parse_pitch_sequence(summary: &serde_json::Value) -> Vec<Pitch> {
    summary["atBats"]
        .as_array()
        .and_then(|abs| abs.last())
        .and_then(|ab| ab["plays"].as_array())
        .map(|plays| {
            plays
                .iter()
                .filter_map(|p| {
                    Some(Pitch {
                        kind: classify_pitch(p),
                        speed_mph: p["pitchVelocity"].as_u64().map(|n| n as u32),
                        pitch_type: p["pitchType"]["text"].as_str().map(String::from),
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

fn classify_pitch(play: &serde_json::Value) -> String {
    let type_text = play["type"]["text"].as_str().unwrap_or("");
    match type_text.to_ascii_lowercase().as_str() {
        s if s.contains("ball") => "ball",
        s if s.contains("called strike") => "called_strike",
        s if s.contains("swinging strike") || s.contains("strike (swinging)") => "swinging_strike",
        s if s.contains("foul") => "foul",
        _ => "in_play",
    }
    .to_string()
}

fn parse_recent_plays(summary: &serde_json::Value, n: usize) -> Vec<Play> {
    summary["plays"]
        .as_array()
        .map(|plays| {
            plays
                .iter()
                .rev()
                .take(n)
                .map(|p| Play {
                    id: p["id"].as_str().unwrap_or("").to_string(),
                    text: p["text"].as_str().unwrap_or("").to_string(),
                    inning_half: p["period"]["type"].as_str().map(String::from),
                    inning_number: p["period"]["number"].as_u64().map(|n| n as u32),
                    scoring: p["scoringPlay"].as_bool().unwrap_or(false),
                })
                .collect()
        })
        .unwrap_or_default()
}

fn parse_leaders(summary: &serde_json::Value) -> GameLeaders {
    let groups = summary["leaders"].as_array().cloned().unwrap_or_default();
    let mut home = Vec::new();
    let mut away = Vec::new();

    for team_group in groups {
        let is_home = team_group["team"]["homeAway"].as_str() == Some("home");
        if let Some(categories) = team_group["leaders"].as_array() {
            for cat in categories {
                let category = cat["displayName"].as_str().unwrap_or("").to_string();
                if let Some(leaders) = cat["leaders"].as_array() {
                    for leader in leaders {
                        let item = Leader {
                            category: category.clone(),
                            player_name: leader["athlete"]["displayName"]
                                .as_str()
                                .unwrap_or("")
                                .to_string(),
                            display_value: leader["displayValue"]
                                .as_str()
                                .unwrap_or("")
                                .to_string(),
                        };
                        if is_home {
                            home.push(item);
                        } else {
                            away.push(item);
                        }
                    }
                }
            }
        }
    }

    GameLeaders { home, away }
}
```

Also re-export from `mod.rs` if needed so the test can import it; if `pub mod transform;` is already in `sports/mod.rs`, nothing more is required.

- [ ] **Step 4: Run tests**

```bash
cargo test -p dashboard-backend --test sports_test parse_summary
```

Expected: both tests pass. If the field-name guesses in the transform don't line up with the captured fixture, adjust until `parse_summary_returns_some_for_sample_fixture` passes. (Print intermediate values with `dbg!` if needed.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/integrations/sports/transform.rs backend/tests/sports_test.rs
git commit -m "feat(sports): transform ESPN summary into LiveGameDetail"
```

---

## Task 5: Wire summary into `get_games`

**Files:**
- Modify: `backend/src/integrations/sports/routes.rs`

- [ ] **Step 1: After scoreboard processing, fetch summaries for live games**

Open `backend/src/integrations/sports/routes.rs` and find where games are built from the scoreboard (around the existing call to `transform::transform_scoreboard`). After the games list is built but before it's returned, add:

```rust
use super::transform::parse_summary_to_live_detail;

// Fetch summary for any live game, with 5 s cache TTL.
for game in games.iter_mut() {
    if game.state != GameState::Live {
        continue;
    }
    let summary_key = format!("summary:{}", game.id);
    let summary_json = match state.cache.get(&summary_key, 5).await {
        Some(cached) => Some(cached),
        None => match espn::fetch_summary(&state.client, &game.sport, &game.league, &game.id).await {
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

    if let Some(summary) = summary_json {
        game.live_detail = parse_summary_to_live_detail(&summary);
    }
}
```

(Field names: confirm `game.sport`, `game.league`, `game.id`, `game.state`, `GameState::Live` match your `types.rs`. Adjust if different.)

- [ ] **Step 2: Build**

```bash
cargo build
```

Expected: clean build.

- [ ] **Step 3: Smoke-test the endpoint**

Start the backend (`cargo run` or whatever the project uses), then:

```bash
curl -s http://localhost:8080/api/sports/games | jq '.[] | {id, state, has_detail: (.live_detail != null)}'
```

Expected: any game with `state == "live"` shows `has_detail: true`; non-live games show `false`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/integrations/sports/routes.rs
git commit -m "feat(sports): embed live_detail per live game in /games response"
```

---

## Task 6: Mirror types in frontend

**Files:**
- Modify: `frontend/src/integrations/sports/types.ts`

- [ ] **Step 1: Add the types**

Append to `frontend/src/integrations/sports/types.ts`:

```typescript
export interface WinProbability {
  home: number
  away: number
}

export interface PitcherInfo {
  id: string
  name: string
  headshotUrl: string | null
  hand: string | null
  era: string | null
  pitchesToday: number | null
  record: string | null
}

export interface BatterInfo {
  id: string
  name: string
  headshotUrl: string | null
  hand: string | null
  avg: string | null
  hr: number | null
  rbi: number | null
  todayLine: string | null
}

export interface Matchup {
  pitcher: PitcherInfo
  batter: BatterInfo
}

export interface Pitch {
  kind: 'ball' | 'called_strike' | 'swinging_strike' | 'foul' | 'in_play'
  speedMph: number | null
  pitchType: string | null
}

export interface Play {
  id: string
  text: string
  inningHalf: string | null
  inningNumber: number | null
  scoring: boolean
}

export interface Leader {
  category: string
  playerName: string
  displayValue: string
}

export interface GameLeaders {
  home: Leader[]
  away: Leader[]
}

export interface MlbLiveDetail {
  sport: 'mlb'
  matchup: Matchup | null
  pitchSequence: Pitch[]
  recentPlays: Play[]
  leaders: GameLeaders
}

export type SportSpecificLiveDetail = MlbLiveDetail
// | NbaLiveDetail (future)

export interface LiveGameDetail {
  winProbability: WinProbability | null
  // The sport-specific block is flattened in via serde tag/flatten on the
  // Rust side, so the JSON includes `sport: "mlb"` at the same level.
}

// On the wire, LiveGameDetail and SportSpecificLiveDetail are merged. Use this
// helper type when consuming the field on a Game:
export type GameLiveDetail = LiveGameDetail & SportSpecificLiveDetail
```

- [ ] **Step 2: Add `liveDetail` to the Game type**

Find the existing `Game` interface in the same file (or in the types it imports from) and add:

```typescript
liveDetail: GameLiveDetail | null
```

- [ ] **Step 3: Build**

```bash
cd frontend && npm run build
```

Expected: clean build (no consumers of `liveDetail` exist yet, so nothing else needs adjusting).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/integrations/sports/types.ts
git commit -m "feat(sports): mirror LiveGameDetail types on frontend"
```

---

## Task 7: Extract BaseDiamond + CountIndicator + add WinProbabilityBar

**Files:**
- Create: `frontend/src/integrations/sports/BaseDiamond.tsx`
- Create: `frontend/src/integrations/sports/CountIndicator.tsx`
- Create: `frontend/src/integrations/sports/WinProbabilityBar.tsx`
- Modify: `frontend/src/integrations/sports/MlbSituation.tsx` (use the extracted components — keep working until Task 12)

- [ ] **Step 1: Write `BaseDiamond.tsx`**

```typescript
interface BaseDiamondProps {
  onFirst: boolean
  onSecond: boolean
  onThird: boolean
  /** Pixel size of the bounding box; defaults to compact. */
  size?: number
}

export function BaseDiamond({ onFirst, onSecond, onThird, size = 52 }: BaseDiamondProps) {
  const base = Math.round(size * 0.25)
  const baseStyle = (occupied: boolean) =>
    `rotate-45 rounded-[2px] border-2 ${
      occupied ? 'bg-palette-6 border-palette-6' : 'border-border bg-transparent'
    }`
  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: `${size}px`, height: `${Math.round(size * 0.85)}px` }}
    >
      {/* 2nd */}
      <div
        className={`absolute top-0 left-1/2 -translate-x-1/2 ${baseStyle(onSecond)}`}
        style={{ width: base, height: base }}
      />
      {/* 3rd */}
      <div
        className={`absolute top-1/2 left-[2px] -translate-y-1/2 ${baseStyle(onThird)}`}
        style={{ width: base, height: base }}
      />
      {/* 1st */}
      <div
        className={`absolute top-1/2 right-[2px] -translate-y-1/2 ${baseStyle(onFirst)}`}
        style={{ width: base, height: base }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Write `CountIndicator.tsx`**

```typescript
interface CountIndicatorProps {
  label: string
  filled: number
  total: number
  /** Tailwind class for the filled dot. */
  color: string
  /** Pixel size of each dot. */
  dotSize?: number
}

export function CountIndicator({ label, filled, total, color, dotSize = 8 }: CountIndicatorProps) {
  return (
    <div className="flex items-center gap-[3px]">
      <span className="text-text-muted text-[11px]">{label}</span>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`rounded-full ${i < filled ? color : 'border border-border'}`}
          style={{ width: dotSize, height: dotSize }}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Write `WinProbabilityBar.tsx`**

```typescript
import type { WinProbability } from './types'

interface WinProbabilityBarProps {
  win: WinProbability
  homeAbbr: string
  awayAbbr: string
}

export function WinProbabilityBar({ win, homeAbbr, awayAbbr }: WinProbabilityBarProps) {
  const homePct = Math.round(win.home * 100)
  const awayPct = 100 - homePct
  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] text-text-muted mb-1">
        <span>{awayAbbr} {awayPct}%</span>
        <span>Win Probability</span>
        <span>{homePct}% {homeAbbr}</span>
      </div>
      <div className="relative w-full h-2 rounded-full overflow-hidden bg-bg-primary">
        <div className="absolute inset-y-0 left-0 bg-palette-3" style={{ width: `${awayPct}%` }} />
        <div className="absolute inset-y-0 right-0 bg-palette-6" style={{ width: `${homePct}%` }} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update `MlbSituation.tsx` to use the extracted primitives**

Replace the inline `Diamond` and `CountDots` functions in `MlbSituation.tsx` with imports:

```typescript
import { BaseDiamond } from './BaseDiamond'
import { CountIndicator } from './CountIndicator'
```

In the JSX, replace `<Diamond ... />` with `<BaseDiamond ... />` and the three `<CountDots ... />` with `<CountIndicator ... />` (same prop names). Delete the now-unused inline functions.

- [ ] **Step 5: Build**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/integrations/sports/BaseDiamond.tsx frontend/src/integrations/sports/CountIndicator.tsx frontend/src/integrations/sports/WinProbabilityBar.tsx frontend/src/integrations/sports/MlbSituation.tsx
git commit -m "refactor(sports): extract BaseDiamond+CountIndicator, add WinProbabilityBar"
```

---

## Task 8: PitcherBatterMatchup panel

**Files:**
- Create: `frontend/src/integrations/sports/PitcherBatterMatchup.tsx`

- [ ] **Step 1: Write the component**

```typescript
import type { Matchup } from './types'

interface PitcherBatterMatchupProps {
  matchup: Matchup
}

function Headshot({ url, alt }: { url: string | null; alt: string }) {
  if (!url) {
    return <div className="w-16 h-16 rounded-full bg-bg-primary border border-border" />
  }
  return (
    <img
      src={url}
      alt={alt}
      className="w-16 h-16 rounded-full object-cover bg-bg-primary border border-border"
      onError={(e) => {
        ;(e.currentTarget as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}

export function PitcherBatterMatchup({ matchup }: PitcherBatterMatchupProps) {
  const { pitcher, batter } = matchup
  return (
    <div className="flex items-stretch gap-3 py-2">
      {/* Pitcher */}
      <div className="flex-1 flex items-center gap-2">
        <Headshot url={pitcher.headshotUrl} alt={pitcher.name} />
        <div className="min-w-0">
          <div className="text-[12px] text-text-muted">Pitching {pitcher.hand ? `(${pitcher.hand})` : ''}</div>
          <div className="text-[14px] font-semibold text-text-primary truncate">{pitcher.name}</div>
          <div className="text-[11px] text-text-muted">
            {pitcher.era ? `ERA ${pitcher.era}` : ''}
            {pitcher.pitchesToday != null ? ` · ${pitcher.pitchesToday} P` : ''}
          </div>
        </div>
      </div>
      <div className="self-center text-text-muted text-[10px]">vs</div>
      {/* Batter */}
      <div className="flex-1 flex items-center gap-2">
        <Headshot url={batter.headshotUrl} alt={batter.name} />
        <div className="min-w-0">
          <div className="text-[12px] text-text-muted">At Bat {batter.hand ? `(${batter.hand})` : ''}</div>
          <div className="text-[14px] font-semibold text-text-primary truncate">{batter.name}</div>
          <div className="text-[11px] text-text-muted">
            {batter.avg ? batter.avg : ''}
            {batter.todayLine ? ` · ${batter.todayLine}` : ''}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/integrations/sports/PitcherBatterMatchup.tsx
git commit -m "feat(sports): add PitcherBatterMatchup panel"
```

---

## Task 9: PitchSequence + PlayByPlayLog

**Files:**
- Create: `frontend/src/integrations/sports/PitchSequence.tsx`
- Create: `frontend/src/integrations/sports/PlayByPlayLog.tsx`

- [ ] **Step 1: Write `PitchSequence.tsx`**

```typescript
import type { Pitch } from './types'

interface PitchSequenceProps {
  pitches: Pitch[]
}

const pitchColor: Record<Pitch['kind'], string> = {
  ball: 'bg-success',
  called_strike: 'bg-error',
  swinging_strike: 'bg-error',
  foul: 'bg-warning',
  in_play: 'bg-palette-3',
}

const pitchLabel: Record<Pitch['kind'], string> = {
  ball: 'B',
  called_strike: 'K',
  swinging_strike: 'K',
  foul: 'F',
  in_play: 'X',
}

export function PitchSequence({ pitches }: PitchSequenceProps) {
  if (pitches.length === 0) return null
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-text-muted">At-bat:</span>
      {pitches.map((pitch, i) => (
        <span
          key={i}
          className={`w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center ${pitchColor[pitch.kind]}`}
          title={`${pitch.pitchType ?? ''} ${pitch.speedMph ? pitch.speedMph + ' mph' : ''}`.trim()}
        >
          {pitchLabel[pitch.kind]}
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Write `PlayByPlayLog.tsx`**

```typescript
import type { Play } from './types'

interface PlayByPlayLogProps {
  plays: Play[]
}

export function PlayByPlayLog({ plays }: PlayByPlayLogProps) {
  if (plays.length === 0) return null
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] text-text-muted">Recent</div>
      <ul className="flex flex-col gap-0.5">
        {plays.map((play) => (
          <li
            key={play.id}
            className={`text-[12px] leading-snug truncate ${play.scoring ? 'text-palette-6 font-semibold' : 'text-text-primary'}`}
          >
            {play.text}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/integrations/sports/PitchSequence.tsx frontend/src/integrations/sports/PlayByPlayLog.tsx
git commit -m "feat(sports): add PitchSequence and PlayByPlayLog"
```

---

## Task 10: GameLeaders

**Files:**
- Create: `frontend/src/integrations/sports/GameLeaders.tsx`

- [ ] **Step 1: Write the component**

```typescript
import type { GameLeaders as Leaders, Leader } from './types'

interface GameLeadersProps {
  leaders: Leaders
  homeAbbr: string
  awayAbbr: string
}

function LeaderRow({ leader }: { leader: Leader }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11px]">
      <span className="text-text-muted truncate">{leader.category}</span>
      <span className="text-text-primary truncate">{leader.playerName}</span>
      <span className="text-text-secondary tabular-nums">{leader.displayValue}</span>
    </div>
  )
}

function TeamColumn({ abbr, leaders }: { abbr: string; leaders: Leader[] }) {
  if (leaders.length === 0) return <div className="flex-1" />
  return (
    <div className="flex-1 flex flex-col gap-1">
      <div className="text-[10px] text-text-muted font-semibold">{abbr}</div>
      {leaders.map((leader, i) => (
        <LeaderRow key={`${leader.category}-${i}`} leader={leader} />
      ))}
    </div>
  )
}

export function GameLeaders({ leaders, homeAbbr, awayAbbr }: GameLeadersProps) {
  if (leaders.home.length === 0 && leaders.away.length === 0) return null
  return (
    <div className="flex items-stretch gap-4 pt-2 border-t border-border">
      <TeamColumn abbr={awayAbbr} leaders={leaders.away} />
      <TeamColumn abbr={homeAbbr} leaders={leaders.home} />
    </div>
  )
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/integrations/sports/GameLeaders.tsx
git commit -m "feat(sports): add GameLeaders strip"
```

---

## Task 11: Assemble MlbLiveCard

**Files:**
- Create: `frontend/src/integrations/sports/MlbLiveCard.tsx`

- [ ] **Step 1: Write the composer**

```typescript
import type { Game, GameLiveDetail } from './types'
import { BaseDiamond } from './BaseDiamond'
import { CountIndicator } from './CountIndicator'
import { WinProbabilityBar } from './WinProbabilityBar'
import { PitcherBatterMatchup } from './PitcherBatterMatchup'
import { PitchSequence } from './PitchSequence'
import { PlayByPlayLog } from './PlayByPlayLog'
import { GameLeaders } from './GameLeaders'
import { MlbLinescore } from './MlbLinescore'

interface MlbLiveCardProps {
  game: Game
  detail: GameLiveDetail
}

export function MlbLiveCard({ game, detail }: MlbLiveCardProps) {
  const situation = game.situation
  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Score + inning header (existing layout pattern — keep score and inning at the top) */}
      <div className="flex items-baseline justify-between">
        <div className="text-[14px] text-text-muted">
          {game.statusDetail ?? ''}
        </div>
      </div>

      {detail.winProbability && (
        <WinProbabilityBar
          win={detail.winProbability}
          homeAbbr={game.home.abbreviation}
          awayAbbr={game.away.abbreviation}
        />
      )}

      {/* Situation row: diamond + B/S/O + batter line */}
      {situation && (
        <div className="flex items-center gap-4 py-2 px-3 bg-bg-primary/50 rounded-lg">
          <BaseDiamond
            onFirst={situation.onFirst}
            onSecond={situation.onSecond}
            onThird={situation.onThird}
            size={80}
          />
          <div className="flex flex-col gap-1">
            <CountIndicator label="B" filled={situation.balls ?? 0} total={4} color="bg-success" dotSize={12} />
            <CountIndicator label="S" filled={situation.strikes ?? 0} total={3} color="bg-error" dotSize={12} />
            <CountIndicator label="O" filled={situation.outs} total={3} color="bg-warning" dotSize={12} />
          </div>
        </div>
      )}

      {detail.matchup && <PitcherBatterMatchup matchup={detail.matchup} />}

      <PitchSequence pitches={detail.pitchSequence} />

      <MlbLinescore game={game} />

      <PlayByPlayLog plays={detail.recentPlays} />

      <GameLeaders
        leaders={detail.leaders}
        homeAbbr={game.home.abbreviation}
        awayAbbr={game.away.abbreviation}
      />
    </div>
  )
}
```

Notes for the implementer:
- `game.situation`, `game.statusDetail`, `game.home.abbreviation`, `game.away.abbreviation` — field names may differ in the existing `Game` type. Open `types.ts` and adjust to match.
- `MlbLinescore` expects a `Game` prop in the existing call site; if it expects something different, pass what it wants.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: clean build (after any field-name adjustments).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/integrations/sports/MlbLiveCard.tsx
git commit -m "feat(sports): compose MlbLiveCard from primitives"
```

---

## Task 12: Wire `GameCardExpanded` state router, retire `MlbSituation`, bump sizing

**Files:**
- Modify: `frontend/src/integrations/sports/GameCardExpanded.tsx`
- Modify: `frontend/src/integrations/sports/useWidgetMeta.ts`
- Modify: `frontend/src/integrations/sports/config.ts`
- Modify: `frontend/src/integrations/sports/useSportsGames.ts` (if it owns the poll cadence — check)
- Delete: `frontend/src/integrations/sports/MlbSituation.tsx`

- [ ] **Step 1: Update `GameCardExpanded.tsx` to route by state**

Open `GameCardExpanded.tsx` and find the existing render. Replace the body with a state-driven switch:

```typescript
import { MlbLiveCard } from './MlbLiveCard'
// (keep existing imports for AiPreview, MlbLinescore, etc)

export function GameCardExpanded({ game }: { game: Game }) {
  if (game.state === 'live' && game.liveDetail) {
    return <MlbLiveCard game={game} detail={game.liveDetail} />
  }
  if (game.state === 'pre') {
    return (
      // existing pre-game JSX with AiPreview
    )
  }
  // final
  return (
    // existing final JSX with score + linescore
  )
}
```

Preserve the existing pre-game and final-state JSX exactly as they are — only the live branch changes.

- [ ] **Step 2: Update `useWidgetMeta.ts` to return xlarge when live**

Find the existing widget-meta hook (`useSportsWidgetMeta`). Modify it so when a tracked-team game is live, `relativeSize` is `'xlarge'`; otherwise the existing default. Something like:

```typescript
import { useSportsGames } from './useSportsGames'

export function useSportsWidgetMeta(): WidgetMeta {
  const { data: games } = useSportsGames()
  const hasLive = (games ?? []).some((g) => g.state === 'live')
  if (!games || games.length === 0) return { visible: false }
  return {
    visible: true,
    priority: 5,
    sizePreference: {
      orientation: 'horizontal',
      relativeSize: hasLive ? 'xlarge' : 'large',
    },
  }
}
```

Field names — `state === 'live'`, `priority`, `orientation` — adjust to match the existing widget-meta shape in the project.

- [ ] **Step 3: Lower `poll_interval_live` default to 5 seconds**

In `frontend/src/integrations/sports/config.ts`, change:

```typescript
poll_interval_live: z.string().optional().default('5'),
```

(was `'30'`)

- [ ] **Step 4: Delete `MlbSituation.tsx` and its references**

```bash
grep -rln "MlbSituation" frontend/src/
```

For each reference outside `MlbSituation.tsx` itself, delete the import and the JSX usage (the compact-card live state now shows score + last-play only; no inline diamond at the small size).

```bash
rm frontend/src/integrations/sports/MlbSituation.tsx
```

- [ ] **Step 5: Build**

```bash
npm run build
```

Expected: clean build. Fix any field-name mismatches surfaced by the compiler.

- [ ] **Step 6: Manual verification**

1. Start backend (`cargo run` from `backend/`) and frontend (`npm run dev` from `frontend/`).
2. Configure a tracked team that currently has a live game in Settings → Sports.
3. Confirm the sports widget takes the `xlarge` slot.
4. Confirm `MlbLiveCard` renders with the diamond, B/S/O, win prob bar, matchup, pitch pips, plays, and leaders.
5. Watch the network tab — `/api/sports/games` should be polled every ~5 s during the live game.
6. Confirm non-live games (or no live games configured) still render the previous compact view and the widget reverts to its prior size.

If MLB isn't in season (or no tracked team is playing), you can still smoke-test by hand-injecting a `liveDetail` into a game in the response payload via React DevTools or a temporary local override.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/integrations/sports/GameCardExpanded.tsx frontend/src/integrations/sports/useWidgetMeta.ts frontend/src/integrations/sports/config.ts
git add -u frontend/src/integrations/sports/   # picks up the deleted MlbSituation.tsx
git commit -m "feat(sports): wire MlbLiveCard, bump xlarge when live, 5s polling"
```

---

## Self-review checklist (run after writing — already complete)

- **Spec coverage:**
  - Backend single-endpoint with summary embedded → Tasks 3 + 5. ✓
  - Tiered cache (scoreboard 30 s, summary 5 s) → existing 30 s scoreboard cache stays, Task 5 adds 5 s `summary:<id>` keys. ✓
  - Sport-agnostic envelope (`win_probability` + tagged `sport_specific`) → Task 2 types. ✓
  - All seven UI features (diamond, B/S/O, matchup, win prob, pitch sequence, plays, leaders) → Tasks 7–11. ✓
  - State-machine router → Task 12 step 1. ✓
  - xlarge size when live → Task 12 step 2. ✓
  - 5 s poll cadence → Task 12 step 3. ✓
  - MlbSituation retirement → Task 12 step 4. ✓
- **Placeholder scan:** No TBD/TODO/"appropriate error handling"/etc.
- **Type consistency:** `LiveGameDetail`, `MlbLiveDetail`, `Matchup`, `Pitch`, `Play`, `Leader`, `GameLeaders`, `WinProbability` all referenced consistently across backend (Task 2) and frontend (Task 6). Frontend uses camelCase fields (`headshotUrl`, `pitchSequence`, `recentPlays`, `winProbability`) — implementer must confirm the JSON serializer is producing camelCase or adjust the frontend types to match snake_case if not.

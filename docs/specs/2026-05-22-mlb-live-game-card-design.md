# MLB Live Game Card — Design

## Context

The current sports widget renders a compact game card with a small diamond, balls/strikes/outs dot indicators, and batter/pitcher names — all sourced from ESPN's `/scoreboard.competition.situation` block. The widget is the same size whether a tracked team has a live game or not, which often leaves the live state feeling cramped while non-live moments have visible empty space.

Inspired by [johnbr/mlb-live-scoreboard](https://github.com/johnbr/mlb-live-scoreboard) (Home Assistant integration, MIT), this spec covers enriching the live MLB game experience with data from ESPN's `/summary?event=<id>` endpoint and a bigger card slot.

## Goals

- During a live MLB game from a tracked team, show a richer, larger card that surfaces win probability, pitcher/batter matchup with stats, current at-bat pitch sequence, recent plays, and game leaders — in addition to the diamond/B-S-O/score/inning we already render.
- Keep the data path simple from the frontend's perspective: one endpoint, one polling hook.
- Lay groundwork so an NBA equivalent slots in without restructuring.

## Non-goals (deferred)

- NBA enrichment (separate spec; uses same scaffolding).
- Probable-starters pre-game treatment.
- Post-game AI recap.
- "Third-out hold" transition UX from the reference repo.
- Headshot fallback handling (address when implementing if it bites).
- AI preview during live games (we drop it, replaced by structured data).

## Architecture

### Backend

One endpoint, summary embedded inline (option C from brainstorming):

- `GET /api/sports/games` (existing route) returns the current list shape, but each `Game` with `state == Live` gains an optional `live_detail: LiveGameDetail` field, populated from ESPN's `/sports/{sport}/{league}/summary?event=<id>`.
- `cache.rs` gains a second cache tier: per-game-summary cached at **5 s TTL**, alongside the existing scoreboard cache at **30 s TTL**. So a frontend poll every 5 s during live games refreshes the summary roughly every poll while only hitting ESPN's scoreboard endpoint about every 30 s.
- The endpoint stays a single source of truth — the frontend doesn't know there are two ESPN endpoints behind it.

### Frontend

- `useSportsGames` (existing) keeps polling `/api/sports/games`; its cadence becomes 5 s when there's a live tracked-team game (was 30 s).
- `GameCardExpanded` becomes a small router by `game.state`:
  - `pre-game` → existing AI preview (unchanged).
  - `live` → new `MlbLiveCard` (replaces the preview + the current compact situation).
  - `final` → score + linescore (no recap, deferred).
- `useSportsWidgetMeta` returns `xlarge` iff there's a tracked-team game in `state == Live`; otherwise its current default. The grid engine handles the slot reshape.

### Data shape

The `LiveGameDetail` block is sport-tagged so NBA can plug in later without changing the envelope:

```
LiveGameDetail {
  win_probability: { home: f32, away: f32 } | null,
  sport_specific: MlbLiveDetail | NbaLiveDetail (future),
}

MlbLiveDetail {
  matchup: {
    pitcher: { name, headshot_url, hand, era, pitch_count_today, ... },
    batter: { name, headshot_url, hand, avg, hr, rbi, ... },
  } | null,
  pitch_sequence: [Pitch],     // current at-bat, most-recent-last
  recent_plays: [Play],         // last ~5
  leaders: { home: [Leader], away: [Leader] },
}
```

The diamond/B-S-O/score/inning continue to come from the scoreboard-level fields we already have — they're not duplicated under `live_detail`.

## Component decomposition (frontend)

`MlbLiveCard` is a layout shell that composes existing and new pieces:

| Piece                           | Source                                   | Status                        |
| ------------------------------- | ---------------------------------------- | ----------------------------- |
| `WinProbabilityBar`             | summary                                  | new                           |
| `BaseDiamond` (bigger, runner names) | scoreboard situation + summary      | extracted from MlbSituation   |
| `CountIndicator` (B/S/O)        | scoreboard situation                     | extracted from MlbSituation   |
| `PitcherBatterMatchup`          | summary                                  | new                           |
| `PitchSequence`                 | summary                                  | new                           |
| `PlayByPlayLog`                 | summary                                  | new                           |
| `GameLeaders`                   | summary                                  | new                           |
| `MlbLinescore` (existing)       | scoreboard                               | reused                        |

`MlbSituation` is retired — its `Diamond` and `CountDots` move into `BaseDiamond` and `CountIndicator` standalone components. Small-card games (live or not) just show score + last-play; no more inline diamond at small sizes.

## Polling and cache behavior

- Backend `cache.rs`: scoreboard TTL 30 s (existing); add `summary_cache: Cache<game_id, LiveGameDetail>` with 5 s TTL.
- On request to `/api/sports/games`:
  1. Fetch scoreboard from cache (hit ~83% of the time at 5 s polling).
  2. For each `Live` game, fetch its summary from the summary cache (refreshes every 5 s).
  3. Merge into response.
- On ESPN error for a summary: log warning, omit `live_detail` for that game (the card falls back to its compact-data presentation). No stale-cache fallback in v1 — add later if ESPN flakes in practice.

## Sport-agnostic shape (for NBA later)

The `LiveGameDetail` envelope holds `win_probability` (sport-agnostic) and a tagged `sport_specific` block. NBA's later spec defines `NbaLiveDetail` and adds a sibling `NbaLiveCard` component selected by the same `game.state` router. The polling, caching, and sizing infrastructure all stay shared.

## Open questions

None blocking. The shape of `Pitch`, `Play`, and `Leader` will be nailed down during implementation by inspecting an actual ESPN `summary` response — they're small enough to defer until we have a sample in front of us.

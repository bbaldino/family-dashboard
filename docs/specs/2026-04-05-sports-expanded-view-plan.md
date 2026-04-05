# Sports Enhanced Expanded View Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the sports widget's expanded view sport-aware — MLB gets a base diamond with batter/count, NBA gets quarter scores, both get a last play bar and ESPN recap headlines.

**Architecture:** Backend expands the `Game` type with a `GameSituation` enum (sport-specific live data), `last_play`, and `headline` fields. Frontend adds sport-specific components (`MlbSituation`, `MlbLinescore`, `NbaLinescore`, `LastPlayBar`, `GameHeadline`) and rewrites `GameCardExpanded` to compose them based on league and game state.

**Tech Stack:** Rust/Axum (backend), React/TypeScript (frontend), ESPN API

**Spec:** `docs/specs/2026-04-05-sports-expanded-view-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `frontend/src/integrations/sports/MlbSituation.tsx` | Diamond + batter + count display |
| `frontend/src/integrations/sports/MlbLinescore.tsx` | Inning-by-inning box score with R/H/E |
| `frontend/src/integrations/sports/NbaLinescore.tsx` | Quarter scores table |
| `frontend/src/integrations/sports/LastPlayBar.tsx` | Accent bar for most recent play |
| `frontend/src/integrations/sports/GameHeadline.tsx` | Recap headline for final games |

### Modified files

| File | Change |
|------|--------|
| `backend/src/integrations/sports/types.rs` | Add `GameSituation` enum, `last_play`, `headline` on `Game` |
| `backend/src/integrations/sports/transform.rs` | Parse structured situation, lastPlay, headline from ESPN |
| `frontend/src/integrations/sports/types.ts` | Add frontend types matching new backend fields |
| `frontend/src/integrations/sports/GameCardExpanded.tsx` | Rewrite to compose sport-specific components by league + state |

---

## Chunk 1: Backend — Structured Game Data

### Task 1: Add GameSituation enum and new fields to types

**Files:**
- Modify: `backend/src/integrations/sports/types.rs`

- [ ] **Step 1: Add the GameSituation enum and update Game**

Add the enum above the `Game` struct:

```rust
/// Sport-specific live game situation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum GameSituation {
    Mlb {
        outs: u8,
        on_first: bool,
        on_second: bool,
        on_third: bool,
        balls: Option<u8>,
        strikes: Option<u8>,
        batter: Option<String>,
        pitcher: Option<String>,
    },
    Nba {},
    Nhl {},
    Nfl {},
}
```

Update the `Game` struct — replace `situation: Option<String>` with three new fields:

```rust
pub struct Game {
    // ... existing fields ...
    pub situation: Option<GameSituation>,
    pub last_play: Option<String>,
    pub headline: Option<String>,
    // ... linescores, athletes, espn_url stay the same ...
}
```

- [ ] **Step 2: Format and verify**

```bash
cd /home/bbaldino/work/dashboard/backend
cargo +nightly fmt && cargo check
```

Will fail — `transform.rs` still assigns a `String` to `situation`. That's expected; we fix it in Task 2.

- [ ] **Step 3: Commit**

```bash
git add backend/src/integrations/sports/types.rs
git commit -m "feat(sports): add GameSituation enum, last_play, and headline fields"
```

---

### Task 2: Update transform to parse structured situation, last play, and headline

**Files:**
- Modify: `backend/src/integrations/sports/transform.rs`

- [ ] **Step 1: Replace parse_mlb_situation to return GameSituation**

Replace the entire `parse_mlb_situation` function:

```rust
fn parse_mlb_situation(situation: &serde_json::Value) -> Option<GameSituation> {
    if situation.is_null() {
        return None;
    }
    Some(GameSituation::Mlb {
        outs: situation["outs"].as_u64().unwrap_or(0) as u8,
        on_first: situation["onFirst"].as_bool().unwrap_or(false),
        on_second: situation["onSecond"].as_bool().unwrap_or(false),
        on_third: situation["onThird"].as_bool().unwrap_or(false),
        balls: situation["balls"].as_u64().map(|v| v as u8),
        strikes: situation["strikes"].as_u64().map(|v| v as u8),
        batter: situation["batter"]["athlete"]["displayName"]
            .as_str()
            .map(|s| s.to_string()),
        pitcher: situation["pitcher"]["athlete"]["displayName"]
            .as_str()
            .map(|s| s.to_string()),
    })
}
```

- [ ] **Step 2: Add last_play parsing function**

Add this function:

```rust
fn parse_last_play(competition: &serde_json::Value) -> Option<String> {
    competition["situation"]["lastPlay"]["text"]
        .as_str()
        .map(|s| s.to_string())
}
```

- [ ] **Step 3: Add headline parsing function**

Add this function:

```rust
fn parse_headline(competition: &serde_json::Value) -> Option<String> {
    competition["headlines"]
        .as_array()
        .and_then(|h| h.first())
        .and_then(|h| h["description"].as_str())
        .map(|s| s.to_string())
}
```

- [ ] **Step 4: Update parse_game to use new functions**

In the `parse_game` function, replace the situation assignment block:

```rust
    // Old:
    // let situation = if league_id == "mlb" && state == GameState::Live {
    //     parse_mlb_situation(&competition["situation"])
    // } else {
    //     None
    // };

    // New:
    let situation = if state == GameState::Live {
        match league_id {
            "mlb" => parse_mlb_situation(&competition["situation"]),
            "nba" => Some(GameSituation::Nba {}),
            "nhl" => Some(GameSituation::Nhl {}),
            "nfl" => Some(GameSituation::Nfl {}),
            _ => None,
        }
    } else {
        None
    };

    let last_play = if state == GameState::Live {
        parse_last_play(competition)
    } else {
        None
    };

    let headline = if state == GameState::Final {
        parse_headline(competition)
    } else {
        None
    };
```

Update the `Game` construction at the end of `parse_game` to include the new fields:

```rust
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
        all_leaders,
        situation,
        last_play,
        headline,
        linescores,
        athletes,
        espn_url,
    })
```

- [ ] **Step 5: Format and verify**

```bash
cd /home/bbaldino/work/dashboard/backend
cargo +nightly fmt && cargo check
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/integrations/sports/transform.rs
git commit -m "feat(sports): parse structured MLB situation, last play, and headline from ESPN"
```

---

## Chunk 2: Frontend — Types and Shared Components

### Task 3: Update frontend types

**Files:**
- Modify: `frontend/src/integrations/sports/types.ts`

- [ ] **Step 1: Add GameSituation types and update Game**

Add the situation types:

```typescript
export interface MlbSituationData {
  type: 'mlb'
  outs: number
  onFirst: boolean
  onSecond: boolean
  onThird: boolean
  balls: number | null
  strikes: number | null
  batter: string | null
  pitcher: string | null
}

export interface NbaSituationData {
  type: 'nba'
}

export interface NhlSituationData {
  type: 'nhl'
}

export interface NflSituationData {
  type: 'nfl'
}

export type GameSituation = MlbSituationData | NbaSituationData | NhlSituationData | NflSituationData
```

Update the `Game` interface — replace `situation: string | null` with the new fields:

```typescript
export interface Game {
  // ... existing fields ...
  situation: GameSituation | null
  lastPlay: string | null
  headline: string | null
  // ... linescores, athletes, espnUrl stay the same ...
}
```

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

Will have errors — `GameCardExpanded.tsx` and `GameCard.tsx` reference the old `situation` as a string. That's expected; we fix them in later tasks.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/integrations/sports/types.ts
git commit -m "feat(sports): add GameSituation union type, lastPlay, headline to frontend types"
```

---

### Task 4: Create LastPlayBar component

**Files:**
- Create: `frontend/src/integrations/sports/LastPlayBar.tsx`

- [ ] **Step 1: Create the component**

```typescript
interface LastPlayBarProps {
  text: string
}

export function LastPlayBar({ text }: LastPlayBarProps) {
  return (
    <div className="mt-3 py-2 px-2.5 bg-palette-6/[0.08] border-l-[3px] border-palette-6 rounded-r">
      <div className="text-[9px] text-palette-6 font-semibold uppercase tracking-[0.5px] mb-0.5">
        Last Play
      </div>
      <div className="text-xs text-text-primary">{text}</div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/integrations/sports/LastPlayBar.tsx
git commit -m "feat(sports): add LastPlayBar component"
```

---

### Task 5: Create GameHeadline component

**Files:**
- Create: `frontend/src/integrations/sports/GameHeadline.tsx`

- [ ] **Step 1: Create the component**

```typescript
interface GameHeadlineProps {
  text: string
}

export function GameHeadline({ text }: GameHeadlineProps) {
  return (
    <div className="mt-3 pt-2 border-t border-border">
      <div className="text-xs text-text-secondary italic leading-relaxed">{text}</div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/integrations/sports/GameHeadline.tsx
git commit -m "feat(sports): add GameHeadline component for ESPN recaps"
```

---

## Chunk 3: Frontend — Sport-Specific Components

### Task 6: Create MlbSituation component

**Files:**
- Create: `frontend/src/integrations/sports/MlbSituation.tsx`

- [ ] **Step 1: Create the component**

```typescript
import type { MlbSituationData } from './types'

interface MlbSituationProps {
  situation: MlbSituationData
}

function Diamond({ onFirst, onSecond, onThird }: { onFirst: boolean; onSecond: boolean; onThird: boolean }) {
  const baseStyle = (occupied: boolean) =>
    `w-[13px] h-[13px] rotate-45 rounded-[2px] border-2 ${
      occupied ? 'bg-palette-6 border-palette-6' : 'border-border bg-transparent'
    }`

  return (
    <div className="w-[52px] h-[44px] relative flex-shrink-0">
      {/* 2nd base (top center) */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 ${baseStyle(onSecond)}`} />
      {/* 3rd base (left middle) */}
      <div className={`absolute top-1/2 left-[2px] -translate-y-1/2 ${baseStyle(onThird)}`} />
      {/* 1st base (right middle) */}
      <div className={`absolute top-1/2 right-[2px] -translate-y-1/2 ${baseStyle(onFirst)}`} />
    </div>
  )
}

function CountDots({
  label,
  filled,
  total,
  color,
}: {
  label: string
  filled: number
  total: number
  color: string
}) {
  return (
    <div className="flex items-center gap-[3px]">
      <span className="text-text-muted text-[11px]">{label}</span>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full ${i < filled ? color : 'border border-border'}`}
        />
      ))}
    </div>
  )
}

export function MlbSituation({ situation }: MlbSituationProps) {
  return (
    <div className="flex items-center gap-4 mt-3 py-2.5 px-3 bg-bg-primary/50 rounded-lg">
      <Diamond
        onFirst={situation.onFirst}
        onSecond={situation.onSecond}
        onThird={situation.onThird}
      />
      <div className="flex-1 min-w-0">
        {situation.batter && (
          <div className="flex items-baseline gap-1.5">
            <span className="text-[13px] font-semibold text-text-primary">{situation.batter}</span>
            <span className="text-[11px] text-text-muted">at bat</span>
          </div>
        )}
        <div className="flex items-center gap-3 mt-1">
          <CountDots label="B" filled={situation.balls ?? 0} total={4} color="bg-success" />
          <CountDots label="S" filled={situation.strikes ?? 0} total={3} color="bg-error" />
          <CountDots label="O" filled={situation.outs} total={3} color="bg-warning" />
        </div>
        {situation.pitcher && (
          <div className="text-[11px] text-text-muted mt-0.5">vs {situation.pitcher}</div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/integrations/sports/MlbSituation.tsx
git commit -m "feat(sports): add MlbSituation component with diamond, batter, and count"
```

---

### Task 7: Create MlbLinescore component

**Files:**
- Create: `frontend/src/integrations/sports/MlbLinescore.tsx`

- [ ] **Step 1: Create the component**

```typescript
import type { Game } from './types'

interface MlbLinescoreProps {
  game: Game
}

export function MlbLinescore({ game }: MlbLinescoreProps) {
  if (game.linescores.length === 0) return null

  const currentPeriod = game.period

  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full text-xs text-text-secondary">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-1 pr-3 font-medium" />
            {game.linescores.map((_, i) => (
              <th
                key={i}
                className={`px-1.5 py-1 font-medium text-center ${
                  currentPeriod != null && i + 1 === currentPeriod ? 'text-palette-6' : ''
                }`}
              >
                {i + 1}
              </th>
            ))}
            <th className="pl-2 py-1 font-bold text-center">R</th>
            <th className="px-1.5 py-1 font-medium text-center">H</th>
            <th className="px-1.5 py-1 font-medium text-center">E</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="py-1 pr-3 font-medium text-text-primary">{game.away.abbreviation}</td>
            {game.linescores.map((ls, i) => (
              <td
                key={i}
                className={`px-1.5 py-1 text-center ${
                  currentPeriod != null && i + 1 === currentPeriod ? 'text-palette-6' : ''
                }`}
              >
                {ls.awayScore}
              </td>
            ))}
            <td className="pl-2 py-1 font-bold text-center text-text-primary">{game.away.score}</td>
            <td className="px-1.5 py-1 text-center">-</td>
            <td className="px-1.5 py-1 text-center">-</td>
          </tr>
          <tr>
            <td className="py-1 pr-3 font-medium text-text-primary">{game.home.abbreviation}</td>
            {game.linescores.map((ls, i) => (
              <td
                key={i}
                className={`px-1.5 py-1 text-center ${
                  currentPeriod != null && i + 1 === currentPeriod ? 'text-palette-6' : ''
                }`}
              >
                {ls.homeScore}
              </td>
            ))}
            <td className="pl-2 py-1 font-bold text-center text-text-primary">{game.home.score}</td>
            <td className="px-1.5 py-1 text-center">-</td>
            <td className="px-1.5 py-1 text-center">-</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
```

Note: The R/H/E columns show "-" for now because ESPN doesn't provide hits and errors in the linescore — only the scoreboard summary. This is a known limitation. The R column shows the total score which is already in `game.away.score` / `game.home.score`. We can enhance this later if ESPN provides the data.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/integrations/sports/MlbLinescore.tsx
git commit -m "feat(sports): add MlbLinescore component with inning-by-inning box score"
```

---

### Task 8: Create NbaLinescore component

**Files:**
- Create: `frontend/src/integrations/sports/NbaLinescore.tsx`

- [ ] **Step 1: Create the component**

```typescript
import type { Game } from './types'

interface NbaLinescoreProps {
  game: Game
}

export function NbaLinescore({ game }: NbaLinescoreProps) {
  if (game.linescores.length === 0) return null

  const currentPeriod = game.period

  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full text-xs text-text-secondary">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-1 pr-3 font-medium" />
            {game.linescores.map((_, i) => (
              <th
                key={i}
                className={`px-2 py-1 font-medium text-center ${
                  currentPeriod != null && i + 1 === currentPeriod ? 'text-palette-6' : ''
                }`}
              >
                {i < 4 ? `Q${i + 1}` : `OT${i - 3}`}
              </th>
            ))}
            <th className="pl-2 py-1 font-bold text-center">T</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="py-1 pr-3 font-medium text-text-primary">{game.away.abbreviation}</td>
            {game.linescores.map((ls, i) => (
              <td
                key={i}
                className={`px-2 py-1 text-center ${
                  currentPeriod != null && i + 1 === currentPeriod ? 'text-palette-6' : ''
                }`}
              >
                {ls.awayScore}
              </td>
            ))}
            <td className="pl-2 py-1 font-bold text-center text-text-primary">{game.away.score}</td>
          </tr>
          <tr>
            <td className="py-1 pr-3 font-medium text-text-primary">{game.home.abbreviation}</td>
            {game.linescores.map((ls, i) => (
              <td
                key={i}
                className={`px-2 py-1 text-center ${
                  currentPeriod != null && i + 1 === currentPeriod ? 'text-palette-6' : ''
                }`}
              >
                {ls.homeScore}
              </td>
            ))}
            <td className="pl-2 py-1 font-bold text-center text-text-primary">{game.home.score}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/integrations/sports/NbaLinescore.tsx
git commit -m "feat(sports): add NbaLinescore component with quarter scores"
```

---

## Chunk 4: Frontend — Rewrite GameCardExpanded

### Task 9: Rewrite GameCardExpanded with sport-specific rendering

**Files:**
- Modify: `frontend/src/integrations/sports/GameCardExpanded.tsx`

- [ ] **Step 1: Rewrite the component**

Replace the entire file:

```typescript
import type { Game, Leader } from './types'
import { AiPreview } from './AiPreview'
import { MlbSituation } from './MlbSituation'
import { MlbLinescore } from './MlbLinescore'
import { NbaLinescore } from './NbaLinescore'
import { LastPlayBar } from './LastPlayBar'
import { GameHeadline } from './GameHeadline'

interface GameCardExpandedProps {
  game: Game
  allGames: Game[]
  onClick?: () => void
}

function LeadersList({ leaders }: { leaders: Leader[] }) {
  if (leaders.length === 0) return null
  return (
    <div className="mt-3">
      <div className="text-xs font-medium text-text-secondary mb-1">Leaders</div>
      <div className="space-y-0.5">
        {leaders.map((l, i) => (
          <div key={i} className="text-xs flex justify-between">
            <span className="text-text-primary">{l.name}</span>
            <span className="text-text-secondary">{l.stats}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function UpcomingSchedule({ games, currentGameId }: { games: Game[]; currentGameId: string }) {
  const upcoming = games
    .filter((g) => g.id !== currentGameId && g.state === 'upcoming')
    .slice(0, 3)

  if (upcoming.length === 0) return null

  return (
    <div className="mt-3">
      <div className="text-xs font-medium text-text-secondary mb-1">Coming Up</div>
      <div className="space-y-1">
        {upcoming.map((g) => {
          const d = new Date(g.startTime)
          const day = d.toLocaleDateString([], { weekday: 'short' })
          const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
          return (
            <div key={g.id} className="text-xs flex justify-between text-text-secondary">
              <span>{g.away.abbreviation} vs {g.home.abbreviation}</span>
              <span>{day} {time}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SportLinescore({ game }: { game: Game }) {
  if (game.league === 'mlb') return <MlbLinescore game={game} />
  if (game.league === 'nba') return <NbaLinescore game={game} />
  // Generic fallback for NHL/NFL
  if (game.linescores.length === 0) return null
  return <NbaLinescore game={game} />
}

export function GameCardExpanded({ game, allGames, onClick }: GameCardExpandedProps) {
  const isLive = game.state === 'live'
  const isFinal = game.state === 'final'
  const isUpcoming = game.state === 'upcoming'

  return (
    <div className="cursor-pointer" onClick={onClick}>
      {/* Main matchup header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {game.away.logo && <img src={game.away.logo} alt="" className="w-8 h-8 object-contain" />}
          <div>
            <div className="text-sm font-bold text-text-primary">{game.away.name}</div>
            <div className="text-xs text-text-secondary">{game.away.record}</div>
          </div>
        </div>

        <div className="text-center">
          {(isLive || isFinal) ? (
            <div className="text-lg font-bold text-text-primary">
              {game.away.score} - {game.home.score}
            </div>
          ) : (
            <div className="text-xs text-text-secondary">vs</div>
          )}
          {isLive && (
            <div className="text-xs text-error font-medium">{game.periodLabel}</div>
          )}
          {isFinal && (
            <div className="text-xs text-text-secondary">Final</div>
          )}
          {isUpcoming && (
            <div className="text-xs text-text-secondary">
              {new Date(game.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-sm font-bold text-text-primary">{game.home.name}</div>
            <div className="text-xs text-text-secondary">{game.home.record}</div>
          </div>
          {game.home.logo && <img src={game.home.logo} alt="" className="w-8 h-8 object-contain" />}
        </div>
      </div>

      {/* Live: sport-specific situation */}
      {isLive && game.situation?.type === 'mlb' && (
        <MlbSituation situation={game.situation} />
      )}

      {/* Live: last play */}
      {isLive && game.lastPlay && (
        <LastPlayBar text={game.lastPlay} />
      )}

      {/* Live + Final: sport-specific linescore */}
      {(isLive || isFinal) && <SportLinescore game={game} />}

      {/* Live + Final: leaders */}
      {(isLive || isFinal) && <LeadersList leaders={game.allLeaders ?? game.leaders} />}

      {/* Final: ESPN recap headline */}
      {isFinal && game.headline && <GameHeadline text={game.headline} />}

      {/* Upcoming: athletes (probable pitchers, etc) */}
      {isUpcoming && game.athletes.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-medium text-text-secondary mb-1">
            {game.league === 'mlb' ? 'Probable Pitchers' : 'Notable'}
          </div>
          <div className="space-y-0.5">
            {game.athletes.map((a, i) => (
              <div key={i} className="text-xs flex justify-between">
                <span className="text-text-primary">{a.name}</span>
                <span className="text-text-secondary">{a.stats ?? a.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming: broadcast info */}
      {isUpcoming && game.broadcast && (
        <div className="mt-2 text-xs text-text-muted">
          {game.broadcast}
        </div>
      )}

      {/* Upcoming: schedule + AI preview */}
      {isUpcoming && <UpcomingSchedule games={allGames} currentGameId={game.id} />}
      {isUpcoming && <AiPreview gameId={game.id} />}
    </div>
  )
}
```

- [ ] **Step 2: Fix GameCard.tsx for new situation type**

The standard `GameCard.tsx` references `game.situation` as a string. Update it to handle the new type. In `GameCard.tsx`, find the line that renders `game.situation`:

```typescript
{isLive && game.situation && (
  <div className="text-[11px] text-text-muted mt-[2px]">{game.situation}</div>
)}
```

Replace with a formatted string for standard cards:

```typescript
{isLive && game.situation?.type === 'mlb' && (
  <div className="text-[11px] text-text-muted mt-[2px]">
    {game.situation.outs} {game.situation.outs === 1 ? 'out' : 'outs'}
    {(game.situation.onFirst || game.situation.onSecond || game.situation.onThird) && ' · '}
    {[
      game.situation.onFirst && '1st',
      game.situation.onSecond && '2nd',
      game.situation.onThird && '3rd',
    ].filter(Boolean).join(', ')}
  </div>
)}
```

- [ ] **Step 3: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 4: Verify build**

```bash
cd /home/bbaldino/work/dashboard/frontend
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/integrations/sports/GameCardExpanded.tsx frontend/src/integrations/sports/GameCard.tsx
git commit -m "feat(sports): rewrite GameCardExpanded with sport-specific components"
```

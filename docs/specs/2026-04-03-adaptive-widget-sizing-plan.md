# Adaptive Widget Sizing Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow widgets to declare size preferences and priorities so the magazine layout engine can dynamically assign sizes, with Sports as the proof-of-concept widget rendering compact/standard/expanded variants.

**Architecture:** Widgets export a `useWidgetMeta()` hook returning supported sizes, preferred size, priority, and optional anchor. The magazine layout engine collects metadata, sorts by priority, and assigns sizes. The grid layout ignores metadata and passes `standard` to all widgets. Sports widget renders three distinct variants based on the resolved size × game state, with an optional AI preview via local Ollama.

**Tech Stack:** React, TypeScript, Axum (Rust), Ollama API, ESPN API (existing)

**Spec:** `docs/specs/2026-04-03-adaptive-widget-sizing-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `frontend/src/lib/widget-types.ts` | `WidgetSize`, `WidgetMeta` type definitions |
| `frontend/src/integrations/sports/useWidgetMeta.ts` | Sports-specific meta hook (size preference + priority by game state) |
| `frontend/src/integrations/sports/GameCardCompact.tsx` | Compact single-line game rendering |
| `frontend/src/integrations/sports/GameCardExpanded.tsx` | Expanded game card with linescore, stats, AI preview |
| `frontend/src/integrations/sports/AiPreview.tsx` | Component that fetches + displays AI game preview |
| `backend/src/integrations/sports/preview.rs` | AI preview endpoint: ESPN context → Ollama → cached summary |

### Modified files

| File | Change |
|------|--------|
| `frontend/src/boards/layouts/MagazineLayout.tsx` | Rewrite to use layout engine with widget metadata |
| `frontend/src/boards/layouts/GridLayout.tsx` | Pass `size="standard"` to children |
| `frontend/src/boards/HomeBoard.tsx` | Wire widget metadata into layout, pass size props |
| `frontend/src/integrations/sports/SportsWidget.tsx` | Accept `size` prop, render compact/standard/expanded variants |
| `frontend/src/integrations/sports/GameCard.tsx` | Minor: export for reuse as the `standard` variant |
| `frontend/src/ui/WidgetCard.tsx` | Accept optional `size` prop for layout-aware styling |
| `backend/src/integrations/sports/mod.rs` | Register preview route |
| `backend/src/integrations/sports/routes.rs` | Add `get_preview` handler |

---

## Chunk 1: Widget Size Protocol

### Task 1: Define widget size types

**Files:**
- Create: `frontend/src/lib/widget-types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// frontend/src/lib/widget-types.ts
export type WidgetSize = 'compact' | 'standard' | 'expanded'

export interface WidgetMeta {
  supportedSizes: WidgetSize[]
  preferredSize: WidgetSize
  priority: number
  anchor?: 'left'
}

/** Default metadata for widgets that don't support adaptive sizing */
export const DEFAULT_WIDGET_META: WidgetMeta = {
  supportedSizes: ['standard'],
  preferredSize: 'standard',
  priority: 0,
}
```

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/widget-types.ts
git commit -m "feat: add WidgetSize and WidgetMeta type definitions"
```

---

### Task 2: Sports widget meta hook

**Files:**
- Create: `frontend/src/integrations/sports/useWidgetMeta.ts`

- [ ] **Step 1: Create the meta hook**

```typescript
// frontend/src/integrations/sports/useWidgetMeta.ts
import type { WidgetMeta } from '@/lib/widget-types'
import { useSportsGames } from './useSportsGames'

export function useSportsWidgetMeta(): WidgetMeta {
  const { data } = useSportsGames()
  const games = data?.games ?? []

  const hasLive = games.some((g) => g.state === 'live')
  const hasUpcomingToday = games.some((g) => {
    if (g.state !== 'upcoming') return false
    const start = new Date(g.startTime)
    const now = new Date()
    return start.toDateString() === now.toDateString()
  })
  const hasFinal = games.some((g) => g.state === 'final')
  const hasUpcoming = games.some((g) => g.state === 'upcoming')

  let preferredSize: WidgetMeta['preferredSize'] = 'standard'
  let priority = 1

  if (hasLive) {
    preferredSize = 'expanded'
    priority = 10
  } else if (hasUpcomingToday) {
    preferredSize = 'expanded'
    priority = 5
  } else if (hasFinal) {
    preferredSize = 'standard'
    priority = 2
  } else if (hasUpcoming) {
    preferredSize = 'standard'
    priority = 3
  }

  return {
    supportedSizes: ['compact', 'standard', 'expanded'],
    preferredSize,
    priority,
  }
}
```

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/integrations/sports/useWidgetMeta.ts
git commit -m "feat(sports): add useWidgetMeta hook with priority by game state"
```

---

## Chunk 2: Layout Engine

### Task 3: Rewrite Magazine layout with engine

**Files:**
- Modify: `frontend/src/boards/layouts/MagazineLayout.tsx`

The magazine layout currently takes plain children and splits them positionally (first = hero, next 2 = sidebar, rest = bottom). Rewrite it to accept widget metadata and assign sizes using the priority algorithm.

- [ ] **Step 1: Define the layout engine types and props**

Replace the contents of `MagazineLayout.tsx` with:

```typescript
import type { ReactElement } from 'react'
import type { WidgetMeta, WidgetSize } from '@/lib/widget-types'

export interface MagazineWidget {
  key: string
  element: ReactElement
  meta: WidgetMeta
  maxSize?: WidgetSize
}

interface MagazineLayoutProps {
  widgets: MagazineWidget[]
}

interface ResolvedWidget {
  key: string
  element: ReactElement
  size: WidgetSize
}

type LayoutConfig =
  | { type: 'primary'; primary: ResolvedWidget; sidebar: ResolvedWidget[]; shelf: ResolvedWidget[] }
  | { type: 'equal-rows'; widgets: ResolvedWidget[] }
```

- [ ] **Step 2: Implement the layout engine function**

Add below the types in the same file:

```typescript
const SIZE_ORDER: WidgetSize[] = ['expanded', 'standard', 'compact']

function capSize(preferred: WidgetSize, max: WidgetSize | undefined): WidgetSize {
  if (!max) return preferred
  const preferredIdx = SIZE_ORDER.indexOf(preferred)
  const maxIdx = SIZE_ORDER.indexOf(max)
  // Higher index = smaller size. Cap means don't go below maxIdx.
  return preferredIdx < maxIdx ? max : preferred
}

function resolveLayout(widgets: MagazineWidget[]): LayoutConfig {
  // Sort by priority descending
  const sorted = [...widgets].sort((a, b) => b.meta.priority - a.meta.priority)

  // Cap preferred sizes at user maxSize
  const capped = sorted.map((w) => ({
    ...w,
    effectivePreferred: capSize(w.meta.preferredSize, w.maxSize),
  }))

  // Check if any widget wants expanded
  const expandedCandidate = capped.find(
    (w) => w.effectivePreferred === 'expanded' && w.meta.supportedSizes.includes('expanded'),
  )

  if (expandedCandidate) {
    const rest = capped.filter((w) => w.key !== expandedCandidate.key)
    const primary: ResolvedWidget = {
      key: expandedCandidate.key,
      element: expandedCandidate.element,
      size: 'expanded',
    }

    // Assign rest to sidebar (compact) and shelf (standard)
    const sidebar: ResolvedWidget[] = []
    const shelf: ResolvedWidget[] = []

    for (const w of rest) {
      if (sidebar.length < 2) {
        sidebar.push({ key: w.key, element: w.element, size: 'compact' })
      } else {
        shelf.push({ key: w.key, element: w.element, size: 'standard' })
      }
    }

    return { type: 'primary', primary, sidebar, shelf }
  }

  // No one wants expanded — equal rows
  return {
    type: 'equal-rows',
    widgets: capped.map((w) => ({
      key: w.key,
      element: w.element,
      size: 'standard',
    })),
  }
}
```

- [ ] **Step 3: Implement the render function**

Add the component:

```typescript
import { cloneElement } from 'react'

function renderWithSize(widget: ResolvedWidget): ReactElement {
  return cloneElement(widget.element, { size: widget.size, key: widget.key })
}

export function MagazineLayout({ widgets }: MagazineLayoutProps) {
  if (widgets.length === 0) return null

  const layout = resolveLayout(widgets)

  if (layout.type === 'equal-rows') {
    return (
      <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-[var(--spacing-grid-gap)] min-h-0" style={{ gridAutoFlow: 'dense' }}>
        {layout.widgets.map(renderWithSize)}
      </div>
    )
  }

  const { primary, sidebar, shelf } = layout

  return (
    <div className="flex-1 flex flex-col gap-[var(--spacing-grid-gap)] min-h-0">
      {/* Top: primary + sidebar */}
      <div className="flex gap-[var(--spacing-grid-gap)] min-h-0" style={{ flex: '3 1 0%' }}>
        <div className="flex-[2] min-h-0 overflow-hidden">
          {renderWithSize(primary)}
        </div>
        {sidebar.length > 0 && (
          <div className="flex-1 flex flex-col gap-[var(--spacing-grid-gap)] min-h-0">
            {sidebar.map((w) => (
              <div key={w.key} className="flex-1 min-h-0 overflow-hidden">
                {renderWithSize(w)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom: shelf */}
      {shelf.length > 0 && (
        <div className="flex gap-[var(--spacing-grid-gap)] min-h-0" style={{ flex: '2 1 0%' }}>
          {shelf.map((w) => (
            <div key={w.key} className="flex-1 min-h-0 overflow-hidden">
              {renderWithSize(w)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/boards/layouts/MagazineLayout.tsx
git commit -m "feat: rewrite magazine layout with priority-based engine"
```

---

### Task 4: Update GridLayout to pass size prop

**Files:**
- Modify: `frontend/src/boards/layouts/GridLayout.tsx`

- [ ] **Step 1: Update GridLayout to accept MagazineWidget array and pass size="standard"**

```typescript
import { cloneElement } from 'react'
import type { ReactElement } from 'react'
import type { MagazineWidget } from './MagazineLayout'

interface GridLayoutProps {
  widgets: MagazineWidget[]
}

export function GridLayout({ widgets }: GridLayoutProps) {
  return (
    <div
      className="flex-1 grid grid-cols-3 grid-rows-2 gap-[var(--spacing-grid-gap)] min-h-0"
      style={{ gridAutoFlow: 'dense' }}
    >
      {widgets.map((w) =>
        cloneElement(w.element, { size: 'standard' as const, key: w.key }),
      )}
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
git add frontend/src/boards/layouts/GridLayout.tsx
git commit -m "feat: update GridLayout to accept widget metadata and pass size prop"
```

---

### Task 5: Wire HomeBoard to pass widget metadata to layouts

**Files:**
- Modify: `frontend/src/boards/HomeBoard.tsx`

- [ ] **Step 1: Update the Widgets component to build metadata array**

Replace the `Widgets` function in HomeBoard.tsx:

```typescript
import { DEFAULT_WIDGET_META } from '@/lib/widget-types'
import type { MagazineWidget } from './layouts/MagazineLayout'
import { useSportsWidgetMeta } from '@/integrations/sports/useWidgetMeta'

function Widgets({ layout }: { layout: LayoutMode }) {
  const sportsMeta = useSportsWidgetMeta()

  const widgets: MagazineWidget[] = [
    { key: 'sports', element: <SportsWidget />, meta: sportsMeta },
    { key: 'packages', element: <PackagesWidget />, meta: DEFAULT_WIDGET_META },
    { key: 'countdowns', element: <CountdownsWidget />, meta: DEFAULT_WIDGET_META },
    { key: 'chores', element: <ChoresWidget />, meta: DEFAULT_WIDGET_META },
    { key: 'lunch', element: <LunchMenuWidget />, meta: DEFAULT_WIDGET_META },
    { key: 'on-this-day', element: <OnThisDayWidget />, meta: DEFAULT_WIDGET_META },
  ]

  const Layout = layout === 'magazine' ? MagazineLayout : GridLayout

  return <Layout widgets={widgets} />
}
```

Also update imports at the top of the file — add the new imports and remove the old `ReactNode` children-based layout usage.

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 3: Test visually**

Open the dashboard. Both grid and magazine layouts should render identically to before — this is a refactor with no visual change. The size prop is passed but widgets ignore it (they don't accept it yet).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/boards/HomeBoard.tsx
git commit -m "feat: wire widget metadata into layout engine"
```

---

## Chunk 3: Sports Widget Size Variants

### Task 6: Compact game card

**Files:**
- Create: `frontend/src/integrations/sports/GameCardCompact.tsx`

- [ ] **Step 1: Create the compact game card component**

A single-line game representation for sidebar/small slots.

```typescript
import type { Game } from './types'

interface GameCardCompactProps {
  game: Game
  onClick?: () => void
}

function formatTime(game: Game): string {
  if (game.state === 'live') {
    return game.periodLabel ?? 'Live'
  }
  if (game.state === 'final') {
    return 'Final'
  }
  const d = new Date(game.startTime)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { weekday: 'short' }) + ' ' +
    d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function GameCardCompact({ game, onClick }: GameCardCompactProps) {
  const hasScore = game.state === 'live' || game.state === 'final'
  const isLive = game.state === 'live'

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-bg-primary transition-colors text-xs"
    >
      {isLive && (
        <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse flex-shrink-0" />
      )}
      <span className="font-medium text-text-primary truncate flex-1">
        {game.away.abbreviation}
        {hasScore ? ` ${game.away.score}` : ''}
        {' vs '}
        {game.home.abbreviation}
        {hasScore ? ` ${game.home.score}` : ''}
      </span>
      <span className="text-text-secondary flex-shrink-0">
        {formatTime(game)}
      </span>
    </button>
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
git add frontend/src/integrations/sports/GameCardCompact.tsx
git commit -m "feat(sports): add compact single-line game card"
```

---

### Task 7: Expanded game card

**Files:**
- Create: `frontend/src/integrations/sports/GameCardExpanded.tsx`

- [ ] **Step 1: Create the expanded game card**

Shows full game detail inline — linescore, leaders, upcoming schedule, and AI preview placeholder.

```typescript
import type { Game, LinescoreEntry, Leader, GameAthlete } from './types'

interface GameCardExpandedProps {
  game: Game
  allGames: Game[]
  onClick?: () => void
}

function Linescore({ game }: { game: Game }) {
  if (game.linescores.length === 0) return null

  const isMLB = game.league === 'mlb'
  const periodLabel = isMLB ? 'Inn' : 'Q'

  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full text-xs text-text-secondary">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-1 pr-3 font-medium">Team</th>
            {game.linescores.map((_, i) => (
              <th key={i} className="px-1.5 py-1 font-medium text-center">
                {i + 1}
              </th>
            ))}
            <th className="pl-2 py-1 font-bold text-center">T</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="py-1 pr-3 font-medium text-text-primary">{game.away.abbreviation}</td>
            {game.linescores.map((ls, i) => (
              <td key={i} className="px-1.5 py-1 text-center">{ls.awayScore}</td>
            ))}
            <td className="pl-2 py-1 font-bold text-center text-text-primary">{game.away.score}</td>
          </tr>
          <tr>
            <td className="py-1 pr-3 font-medium text-text-primary">{game.home.abbreviation}</td>
            {game.linescores.map((ls, i) => (
              <td key={i} className="px-1.5 py-1 text-center">{ls.homeScore}</td>
            ))}
            <td className="pl-2 py-1 font-bold text-center text-text-primary">{game.home.score}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
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

      {/* Situation (MLB live) */}
      {isLive && game.situation && (
        <div className="text-xs text-text-secondary mt-1 text-center">{game.situation}</div>
      )}

      {/* Linescore (live + final) */}
      {(isLive || isFinal) && <Linescore game={game} />}

      {/* Leaders (live + final) */}
      {(isLive || isFinal) && <LeadersList leaders={game.allLeaders ?? game.leaders} />}

      {/* Athletes (upcoming: probable pitchers, final: featured) */}
      {game.athletes.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-medium text-text-secondary mb-1">
            {isUpcoming ? 'Probable Pitchers' : 'Notable'}
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

      {/* Upcoming schedule (when this game is upcoming or there's room) */}
      {isUpcoming && <UpcomingSchedule games={allGames} currentGameId={game.id} />}

      {/* AI Preview placeholder — wired in Task 10 */}
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
git add frontend/src/integrations/sports/GameCardExpanded.tsx
git commit -m "feat(sports): add expanded game card with linescore, leaders, upcoming schedule"
```

---

### Task 8: Update SportsWidget to accept and render by size

**Files:**
- Modify: `frontend/src/integrations/sports/SportsWidget.tsx`

- [ ] **Step 1: Add size prop and render variants**

Update SportsWidget to accept a `size` prop and render different layouts:

- `compact`: List of `GameCardCompact` items, no detail modal, limited to 3 games
- `standard`: Current behavior (list of `GameCard` items with modal)
- `expanded`: Featured game as `GameCardExpanded` at top, remaining as `GameCard` list below

The widget needs to import the new components and switch rendering based on `size`. The `WidgetCard` wrapper stays the same for all sizes.

Key changes:
- Add `size?: WidgetSize` to the component props (import from `@/lib/widget-types`)
- Default to `'standard'` if not provided
- Import `GameCardCompact` and `GameCardExpanded`
- For `compact`: render `GameCardCompact` list (max 3), no modal state
- For `standard`: current rendering (no changes)
- For `expanded`: pick the most important game (first live, else first upcoming, else first final), render as `GameCardExpanded`, render remaining as `GameCard` list below it

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 3: Test all three sizes visually**

Set `dashboard.layout` to `magazine` in config. The sports widget should now render expanded in the primary slot (if it has the highest priority). Switch to grid layout — should render standard.

To test compact, temporarily hardcode size="compact" on the SportsWidget in HomeBoard.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/integrations/sports/SportsWidget.tsx
git commit -m "feat(sports): render compact/standard/expanded variants based on size prop"
```

---

## Chunk 4: AI Game Preview

### Task 9: Backend AI preview endpoint

**Files:**
- Create: `backend/src/integrations/sports/preview.rs`
- Modify: `backend/src/integrations/sports/mod.rs`
- Modify: `backend/src/integrations/sports/routes.rs`

- [ ] **Step 1: Create preview module**

Create `backend/src/integrations/sports/preview.rs`:

```rust
use std::collections::HashMap;
use std::sync::RwLock;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;
use sqlx::SqlitePool;

pub struct PreviewCache {
    entries: RwLock<HashMap<String, CacheEntry>>,
}

struct CacheEntry {
    summary: String,
    created_at: chrono::DateTime<chrono::Utc>,
}

impl PreviewCache {
    pub fn new() -> Self {
        Self {
            entries: RwLock::new(HashMap::new()),
        }
    }

    pub fn get(&self, game_id: &str) -> Option<String> {
        let entries = self.entries.read().ok()?;
        let entry = entries.get(game_id)?;
        // Cache for 24 hours
        if chrono::Utc::now() - entry.created_at > chrono::Duration::hours(24) {
            return None;
        }
        Some(entry.summary.clone())
    }

    pub fn set(&self, game_id: &str, summary: String) {
        if let Ok(mut entries) = self.entries.write() {
            entries.insert(
                game_id.to_string(),
                CacheEntry {
                    summary,
                    created_at: chrono::Utc::now(),
                },
            );
        }
    }
}

pub async fn generate_preview(
    pool: &SqlitePool,
    game_context: &str,
) -> Result<String, AppError> {
    let config = IntegrationConfig::new(pool, "sports");
    let ollama_url = config
        .get("ollama_url")
        .await
        .map_err(|_| AppError::BadRequest("Ollama URL not configured".to_string()))?;

    let prompt = format!(
        "You are a friendly sports analyst for a family kitchen dashboard. \
         Given the following game information, write a 2-3 sentence preview \
         that covers the matchup context, recent form, and anything notable. \
         Keep it conversational and family-friendly. No stats dumps — just \
         the story of why this game is interesting.\n\n{}",
        game_context
    );

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/api/generate", ollama_url.trim_end_matches('/')))
        .json(&serde_json::json!({
            "model": "llama3.2",
            "prompt": prompt,
            "stream": false,
        }))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Ollama request failed: {}", e)))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!("Ollama error: {}", body)));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Ollama parse failed: {}", e)))?;

    let summary = data["response"]
        .as_str()
        .unwrap_or("Unable to generate preview.")
        .trim()
        .to_string();

    Ok(summary)
}
```

- [ ] **Step 2: Add the route handler**

Add to `backend/src/integrations/sports/routes.rs`:

```rust
use super::preview::PreviewCache;

// Add PreviewCache to SportsState:
// pub preview_cache: Arc<PreviewCache>,

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

    // Find the game in the current cache to build context
    let games_data = state.cache.get_stale("all_games");
    let game_context = if let Some(data) = games_data {
        // Extract game info for the prompt
        let games: Vec<serde_json::Value> = serde_json::from_value(data).unwrap_or_default();
        games
            .iter()
            .find(|g| g["id"].as_str() == Some(&params.game_id))
            .map(|g| {
                format!(
                    "Game: {} vs {}\nHome record: {}\nAway record: {}\nLeague: {}\nStart: {}",
                    g["away"]["name"].as_str().unwrap_or("?"),
                    g["home"]["name"].as_str().unwrap_or("?"),
                    g["home"]["record"].as_str().unwrap_or("?"),
                    g["away"]["record"].as_str().unwrap_or("?"),
                    g["league"].as_str().unwrap_or("?"),
                    g["startTime"].as_str().unwrap_or("?"),
                )
            })
            .unwrap_or_else(|| format!("Game ID: {}", params.game_id))
    } else {
        format!("Game ID: {}", params.game_id)
    };

    let summary =
        super::preview::generate_preview(&state.pool, &game_context).await?;

    // Cache the result
    state.preview_cache.set(&params.game_id, summary.clone());

    Ok(Json(serde_json::json!({ "summary": summary })))
}
```

- [ ] **Step 3: Register route and update state**

In `mod.rs`, add `pub mod preview;` and add the `/preview` route. Update `SportsState` to include `preview_cache: Arc<PreviewCache>` and construct it in the router function.

- [ ] **Step 4: Format and verify**

```bash
cd /home/bbaldino/work/dashboard/backend
cargo +nightly fmt && cargo check
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/integrations/sports/
git commit -m "feat(sports): add AI game preview endpoint via Ollama"
```

---

### Task 10: Frontend AI preview component

**Files:**
- Create: `frontend/src/integrations/sports/AiPreview.tsx`
- Modify: `frontend/src/integrations/sports/GameCardExpanded.tsx`

- [ ] **Step 1: Create AiPreview component**

```typescript
import { useQuery } from '@tanstack/react-query'
import { sportsIntegration } from './config'

interface AiPreviewProps {
  gameId: string
}

export function AiPreview({ gameId }: AiPreviewProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['sports', 'preview', gameId],
    queryFn: () =>
      sportsIntegration.api.get<{ summary: string }>(`/preview?game_id=${encodeURIComponent(gameId)}`),
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
  })

  if (isLoading) {
    return (
      <div className="mt-3 text-xs text-text-muted italic animate-pulse">
        Generating preview...
      </div>
    )
  }

  if (error || !data?.summary) return null

  return (
    <div className="mt-3 border-t border-border pt-2">
      <div className="text-xs text-text-secondary italic leading-relaxed">
        {data.summary}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire into GameCardExpanded**

In `GameCardExpanded.tsx`, replace the `{/* AI Preview placeholder — wired in Task 10 */}` comment with:

```typescript
import { AiPreview } from './AiPreview'

// At the end of the component, before the closing </div>:
{isUpcoming && <AiPreview gameId={game.id} />}
```

- [ ] **Step 3: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/integrations/sports/AiPreview.tsx frontend/src/integrations/sports/GameCardExpanded.tsx
git commit -m "feat(sports): add AI game preview component for expanded view"
```

---

## Chunk 5: User maxSize Config

### Task 11: Read per-widget maxSize from config

**Files:**
- Modify: `frontend/src/boards/HomeBoard.tsx`

- [ ] **Step 1: Add maxSize reading to the Widgets component**

Update the `Widgets` function to read `dashboard.widget.<id>.maxSize` from config:

```typescript
function useWidgetMaxSizes(): Record<string, WidgetSize | undefined> {
  const [maxSizes, setMaxSizes] = useState<Record<string, WidgetSize | undefined>>({})

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((config: Record<string, string>) => {
        const sizes: Record<string, WidgetSize | undefined> = {}
        for (const [key, value] of Object.entries(config)) {
          const match = key.match(/^dashboard\.widget\.(.+)\.maxSize$/)
          if (match && (value === 'compact' || value === 'standard' || value === 'expanded')) {
            sizes[match[1]] = value as WidgetSize
          }
        }
        setMaxSizes(sizes)
      })
      .catch(() => {})
  }, [])

  return maxSizes
}
```

Then in the `Widgets` function, apply `maxSize` to each widget's metadata:

```typescript
function Widgets({ layout }: { layout: LayoutMode }) {
  const sportsMeta = useSportsWidgetMeta()
  const maxSizes = useWidgetMaxSizes()

  const widgets: MagazineWidget[] = [
    { key: 'sports', element: <SportsWidget />, meta: sportsMeta, maxSize: maxSizes['sports'] },
    { key: 'packages', element: <PackagesWidget />, meta: DEFAULT_WIDGET_META, maxSize: maxSizes['packages'] },
    { key: 'countdowns', element: <CountdownsWidget />, meta: DEFAULT_WIDGET_META, maxSize: maxSizes['countdowns'] },
    { key: 'chores', element: <ChoresWidget />, meta: DEFAULT_WIDGET_META, maxSize: maxSizes['chores'] },
    { key: 'lunch', element: <LunchMenuWidget />, meta: DEFAULT_WIDGET_META, maxSize: maxSizes['lunch'] },
    { key: 'on-this-day', element: <OnThisDayWidget />, meta: DEFAULT_WIDGET_META, maxSize: maxSizes['on-this-day'] },
  ]

  const Layout = layout === 'magazine' ? MagazineLayout : GridLayout

  return <Layout widgets={widgets} />
}
```

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 3: Test maxSize override**

```bash
curl -X PUT http://localhost:3042/api/config/dashboard.widget.sports.maxSize \
  -H "Content-Type: application/json" \
  -d '{"value":"standard"}'
```

Refresh dashboard — sports should no longer claim the expanded/primary slot even with a live game.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/boards/HomeBoard.tsx
git commit -m "feat: support per-widget maxSize config to cap size preferences"
```

---

### Task 12: Add widget size settings to Dashboard settings page

**Files:**
- Modify: `frontend/src/integrations/dashboard/DashboardSettings.tsx`

- [ ] **Step 1: Add per-widget maxSize controls**

Add a section below the layout picker that shows each widget with a maxSize dropdown (compact/standard/expanded/auto). "Auto" means no cap (deletes the config key). Only show this section when layout is set to `magazine`.

The widgets to show: sports, packages, countdowns, chores, lunch, on-this-day. Each gets a row with the widget name and a `<select>` dropdown.

Load current values from config on mount (look for `dashboard.widget.<id>.maxSize` keys). On save, write all values via PUT, or delete keys set to "auto".

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/integrations/dashboard/DashboardSettings.tsx
git commit -m "feat(settings): add per-widget maxSize controls for magazine layout"
```

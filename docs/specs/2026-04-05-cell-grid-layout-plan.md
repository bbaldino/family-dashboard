# Cell-Based Grid Layout Engine Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded flex-based MagazineLayout/GridLayout with a configurable cell grid where widgets declare shape/size preferences and the engine maps them to cell spans.

**Architecture:** New type system (`WidgetSizePreference` with orientation + relativeSize) replaces old `WidgetSize`. A grid engine computes cell spans and places widgets (anchored first, then by priority). A single `CellGridLayout` component renders via CSS Grid. Calendar becomes a grid widget instead of a special-case sidebar.

**Tech Stack:** React, TypeScript, CSS Grid

**Spec:** `docs/specs/2026-04-05-cell-grid-layout-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `frontend/src/boards/layouts/gridEngine.ts` | Span computation + placement algorithm |
| `frontend/src/boards/layouts/CellGridLayout.tsx` | CSS Grid rendering |
| `frontend/src/integrations/google-calendar/useWidgetMeta.ts` | Calendar widget meta (vertical, large, anchored) |

### Modified files

| File | Change |
|------|--------|
| `frontend/src/lib/widget-types.ts` | Replace `WidgetSize` with `WidgetSizePreference`, update `WidgetMeta` |
| `frontend/src/boards/HomeBoard.tsx` | Remove calendar special-case, use CellGridLayout, update filler distribution |
| `frontend/src/integrations/dashboard/DashboardSettings.tsx` | Replace layout picker with rows/columns settings |
| All 10 widget `useWidgetMeta.ts` files | Return new `sizePreference` field |
| `frontend/src/ui/MetaFillerWidget.tsx` | Update meta type for filler entries |
| `frontend/src/integrations/google-calendar/CalendarWidget.tsx` | Accept data via props (no change needed — already does) |

### Removed files

| File | Reason |
|------|--------|
| `frontend/src/boards/layouts/MagazineLayout.tsx` | Replaced by CellGridLayout |
| `frontend/src/boards/layouts/GridLayout.tsx` | Replaced by CellGridLayout |

---

## Chunk 1: New Type System

### Task 1: Replace WidgetSize with WidgetSizePreference and update WidgetMeta

**Files:**
- Modify: `frontend/src/lib/widget-types.ts`

- [ ] **Step 1: Replace the types**

Replace the entire file:

```typescript
export type Orientation = 'vertical' | 'horizontal' | 'square'
export type RelativeSize = 'small' | 'medium' | 'large'

export interface WidgetSizePreference {
  orientation: Orientation
  relativeSize: RelativeSize
}

export type WidgetMeta =
  | { visible: false }
  | {
      visible: true
      priority: number
      sizePreference: WidgetSizePreference
      anchor?: { column: number; row: number }
    }
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/widget-types.ts
git commit -m "refactor: replace WidgetSize with WidgetSizePreference (orientation + relativeSize)"
```

This will break many files — we fix them in subsequent tasks.

---

## Chunk 2: Grid Engine

### Task 2: Create the grid placement engine

**Files:**
- Create: `frontend/src/boards/layouts/gridEngine.ts`

- [ ] **Step 1: Create the engine**

```typescript
import type { ReactElement } from 'react'
import type { WidgetSizePreference, WidgetMeta } from '@/lib/widget-types'

export interface GridWidget {
  key: string
  element: ReactElement
  meta: WidgetMeta & { visible: true }
}

export interface PlacedWidget {
  key: string
  element: ReactElement
  colStart: number
  rowStart: number
  colSpan: number
  rowSpan: number
}

export interface GridConfig {
  columns: number
  rows: number
}

/** Compute cell spans from a size preference and grid dimensions */
export function computeSpan(
  pref: WidgetSizePreference,
  grid: GridConfig,
): { colSpan: number; rowSpan: number } {
  const minDim = Math.min(grid.columns, grid.rows)

  const sizeToSpan = (size: 'small' | 'medium' | 'large'): number => {
    switch (size) {
      case 'small':
        return Math.max(1, Math.floor(minDim / 6))
      case 'medium':
        return Math.max(1, Math.floor(minDim / 3))
      case 'large':
        return Math.max(1, Math.floor(minDim / 2))
    }
  }

  const smallSpan = Math.max(1, Math.floor(minDim / 6))
  const span = sizeToSpan(pref.relativeSize)

  switch (pref.orientation) {
    case 'square':
      return { colSpan: span, rowSpan: span }
    case 'vertical':
      if (pref.relativeSize === 'large') {
        return { colSpan: smallSpan, rowSpan: grid.rows }
      }
      return { colSpan: smallSpan, rowSpan: span }
    case 'horizontal':
      if (pref.relativeSize === 'large') {
        return { colSpan: grid.columns, rowSpan: smallSpan }
      }
      return { colSpan: span, rowSpan: smallSpan }
  }
}

/** Shrink a span by one step: large→medium→small→minimum(1×1) */
function shrinkSpan(
  pref: WidgetSizePreference,
  grid: GridConfig,
): WidgetSizePreference | null {
  const smaller: Record<string, 'small' | 'medium' | undefined> = {
    large: 'medium',
    medium: 'small',
  }
  const next = smaller[pref.relativeSize]
  if (!next) return null
  return { ...pref, relativeSize: next }
}

/** Check if a region starting at (col, row) with given span is free */
function regionFree(
  occupied: boolean[][],
  col: number,
  row: number,
  colSpan: number,
  rowSpan: number,
  grid: GridConfig,
): boolean {
  if (col + colSpan > grid.columns || row + rowSpan > grid.rows) return false
  for (let r = row; r < row + rowSpan; r++) {
    for (let c = col; c < col + colSpan; c++) {
      if (occupied[r][c]) return false
    }
  }
  return true
}

/** Mark a region as occupied */
function markOccupied(
  occupied: boolean[][],
  col: number,
  row: number,
  colSpan: number,
  rowSpan: number,
): void {
  for (let r = row; r < row + rowSpan; r++) {
    for (let c = col; c < col + colSpan; c++) {
      occupied[r][c] = true
    }
  }
}

/** Find the first free region that fits the span, scanning top-left to bottom-right */
function findFreeRegion(
  occupied: boolean[][],
  colSpan: number,
  rowSpan: number,
  grid: GridConfig,
): { col: number; row: number } | null {
  for (let r = 0; r <= grid.rows - rowSpan; r++) {
    for (let c = 0; c <= grid.columns - colSpan; c++) {
      if (regionFree(occupied, c, r, colSpan, rowSpan, grid)) {
        return { col: c, row: r }
      }
    }
  }
  return null
}

/** Count unoccupied cells */
export function countFreeCells(occupied: boolean[][]): number {
  let count = 0
  for (const row of occupied) {
    for (const cell of row) {
      if (!cell) count++
    }
  }
  return count
}

/**
 * Place widgets on the grid.
 * 1. Place anchored widgets first at their declared positions
 * 2. Place remaining widgets by priority (descending), finding first available region
 * 3. If a widget doesn't fit at preferred size, shrink and retry
 * 4. Returns placed widgets + count of remaining free cells
 */
export function placeWidgets(
  widgets: GridWidget[],
  grid: GridConfig,
): { placed: PlacedWidget[]; freeCells: number } {
  const occupied: boolean[][] = Array.from({ length: grid.rows }, () =>
    Array(grid.columns).fill(false),
  )
  const placed: PlacedWidget[] = []

  // Separate anchored vs non-anchored
  const anchored = widgets.filter((w) => w.meta.anchor != null)
  const floating = widgets
    .filter((w) => w.meta.anchor == null)
    .sort((a, b) => b.meta.priority - a.meta.priority)

  // Place anchored widgets first
  for (const w of anchored) {
    const anchor = w.meta.anchor!
    const { colSpan, rowSpan } = computeSpan(w.meta.sizePreference, grid)
    const col = anchor.column - 1 // 1-based to 0-based
    const row = anchor.row - 1

    if (regionFree(occupied, col, row, colSpan, rowSpan, grid)) {
      markOccupied(occupied, col, row, colSpan, rowSpan)
      placed.push({
        key: w.key,
        element: w.element,
        colStart: col + 1, // CSS Grid is 1-based
        rowStart: row + 1,
        colSpan,
        rowSpan,
      })
    }
  }

  // Place floating widgets by priority
  for (const w of floating) {
    let pref: WidgetSizePreference | null = w.meta.sizePreference

    while (pref) {
      const { colSpan, rowSpan } = computeSpan(pref, grid)
      const pos = findFreeRegion(occupied, colSpan, rowSpan, grid)
      if (pos) {
        markOccupied(occupied, pos.col, pos.row, colSpan, rowSpan)
        placed.push({
          key: w.key,
          element: w.element,
          colStart: pos.col + 1,
          rowStart: pos.row + 1,
          colSpan,
          rowSpan,
        })
        break
      }
      pref = shrinkSpan(pref, grid)
    }
    // If pref is null, widget doesn't fit at any size — dropped
  }

  return { placed, freeCells: countFreeCells(occupied) }
}
```

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

May have errors from other files — that's fine, this file should compile independently.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/boards/layouts/gridEngine.ts
git commit -m "feat: add grid placement engine with span computation and priority packing"
```

---

### Task 3: Create CellGridLayout component

**Files:**
- Create: `frontend/src/boards/layouts/CellGridLayout.tsx`

- [ ] **Step 1: Create the component**

```typescript
import type { ReactElement } from 'react'
import type { WidgetMeta } from '@/lib/widget-types'
import { placeWidgets, type GridConfig, type GridWidget } from './gridEngine'

export interface CellGridWidget {
  key: string
  element: ReactElement
  meta: WidgetMeta
}

interface CellGridLayoutProps {
  widgets: CellGridWidget[]
  columns: number
  rows: number
}

export function CellGridLayout({ widgets, columns, rows }: CellGridLayoutProps) {
  const grid: GridConfig = { columns, rows }

  // Filter to visible widgets with type narrowing
  const visible = widgets.filter(
    (w): w is CellGridWidget & { meta: WidgetMeta & { visible: true } } => w.meta.visible,
  ) as GridWidget[]

  const { placed } = placeWidgets(visible, grid)

  if (placed.length === 0) return null

  return (
    <div
      className="flex-1 grid gap-[var(--spacing-grid-gap)] min-h-0"
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
    >
      {placed.map((w) => (
        <div
          key={w.key}
          className="min-h-0 overflow-hidden"
          style={{
            gridColumn: `${w.colStart} / span ${w.colSpan}`,
            gridRow: `${w.rowStart} / span ${w.rowSpan}`,
          }}
        >
          {w.element}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/boards/layouts/CellGridLayout.tsx
git commit -m "feat: add CellGridLayout component with CSS Grid cell placement"
```

---

## Chunk 3: Update All Widget Meta Hooks

### Task 4: Update all widget useWidgetMeta hooks to new type

**Files:**
- Modify: All 10 `useWidgetMeta.ts` files
- Create: `frontend/src/integrations/google-calendar/useWidgetMeta.ts`

- [ ] **Step 1: Sports**

Replace `frontend/src/integrations/sports/useWidgetMeta.ts`:

```typescript
import type { WidgetMeta } from '@/lib/widget-types'
import { useSportsGames } from './useSportsGames'

export function useSportsWidgetMeta(): WidgetMeta {
  const { data } = useSportsGames()
  const games = data?.games ?? []

  if (games.length === 0) {
    return { visible: false }
  }

  const hasLive = games.some((g) => g.state === 'live')
  const hasUpcomingToday = games.some((g) => {
    if (g.state !== 'upcoming') return false
    const start = new Date(g.startTime)
    const now = new Date()
    return start.toDateString() === now.toDateString()
  })
  const hasFinal = games.some((g) => g.state === 'final')
  const hasUpcoming = games.some((g) => g.state === 'upcoming')

  if (hasLive) {
    return { visible: true, priority: 10, sizePreference: { orientation: 'square', relativeSize: 'large' } }
  }
  if (hasUpcomingToday) {
    return { visible: true, priority: 5, sizePreference: { orientation: 'square', relativeSize: 'large' } }
  }
  if (hasFinal) {
    return { visible: true, priority: 4, sizePreference: { orientation: 'square', relativeSize: 'large' } }
  }
  if (hasUpcoming) {
    return { visible: true, priority: 3, sizePreference: { orientation: 'square', relativeSize: 'medium' } }
  }

  return { visible: true, priority: 1, sizePreference: { orientation: 'square', relativeSize: 'medium' } }
}
```

- [ ] **Step 2: Packages**

Replace `frontend/src/integrations/packages/useWidgetMeta.ts`:

```typescript
import type { WidgetMeta } from '@/lib/widget-types'
import { usePackages } from './usePackages'
import type { ShipmentStatus } from './types'

const HIDDEN_STATUSES: ShipmentStatus[] = ['cancelled', 'returned']

export function usePackagesWidgetMeta(): WidgetMeta {
  const { data } = usePackages()
  const shipments = data?.shipments ?? []

  const visible = shipments.filter((s) => !HIDDEN_STATUSES.includes(s.status))
  if (visible.length === 0) {
    return { visible: false }
  }

  const hasDeliveryToday = visible.some((s) => s.status === 'out_for_delivery')

  return {
    visible: true,
    priority: hasDeliveryToday ? 5 : 3,
    sizePreference: { orientation: 'square', relativeSize: 'medium' },
  }
}
```

- [ ] **Step 3: Chores**

Replace `frontend/src/integrations/chores/useWidgetMeta.ts`:

```typescript
import type { WidgetMeta } from '@/lib/widget-types'
import { useChores } from './useChores'

export function useChoresWidgetMeta(): WidgetMeta {
  const { data } = useChores()
  const persons = data?.persons ?? []

  const hasAssignments = persons.some((p) => p.assignments.length > 0)
  if (!hasAssignments) {
    return { visible: false }
  }

  return { visible: true, priority: 4, sizePreference: { orientation: 'square', relativeSize: 'medium' } }
}
```

- [ ] **Step 4: Countdowns**

Replace `frontend/src/integrations/countdowns/useWidgetMeta.ts`:

```typescript
import type { WidgetMeta } from '@/lib/widget-types'
import { useCountdowns } from './useCountdowns'

export function useCountdownsWidgetMeta(): WidgetMeta {
  const { data } = useCountdowns()
  const items = data ?? []

  if (items.length === 0) {
    return { visible: false }
  }

  return { visible: true, priority: 2, sizePreference: { orientation: 'vertical', relativeSize: 'medium' } }
}
```

- [ ] **Step 5: Lunch menu**

Replace `frontend/src/integrations/nutrislice/useWidgetMeta.ts`:

```typescript
import type { WidgetMeta } from '@/lib/widget-types'
import { useLunchMenu } from './useLunchMenu'

export function useLunchWidgetMeta(): WidgetMeta {
  const { data } = useLunchMenu()

  const hasToday = data?.today != null
  const hasTomorrow = data?.tomorrow != null

  if (!hasToday && !hasTomorrow) {
    return { visible: false }
  }

  if (hasToday) {
    return { visible: true, priority: 3, sizePreference: { orientation: 'square', relativeSize: 'large' } }
  }

  return { visible: true, priority: 1, sizePreference: { orientation: 'square', relativeSize: 'medium' } }
}
```

- [ ] **Step 6: On This Day**

Replace `frontend/src/integrations/on-this-day/useWidgetMeta.ts`:

```typescript
import type { WidgetMeta } from '@/lib/widget-types'
import { useOnThisDay } from './useOnThisDay'

export function useOnThisDayWidgetMeta(): WidgetMeta {
  const { data } = useOnThisDay()
  const events = data?.events ?? []

  if (events.length === 0) {
    return { visible: true, priority: 0, sizePreference: { orientation: 'square', relativeSize: 'small' } }
  }

  return { visible: true, priority: 0, sizePreference: { orientation: 'square', relativeSize: 'small' } }
}
```

- [ ] **Step 7: Word of the Day**

Replace `frontend/src/integrations/word-of-the-day/useWidgetMeta.ts`:

```typescript
import type { WidgetMeta } from '@/lib/widget-types'
import { useIntegrationConfig } from '@/integrations/use-integration-config'
import { wordOfTheDayIntegration } from './config'

export function useWordOfTheDayWidgetMeta(): WidgetMeta {
  const config = useIntegrationConfig(wordOfTheDayIntegration)
  const hasKey = !!config?.api_key

  if (!hasKey) {
    return { visible: false }
  }

  return { visible: true, priority: 0, sizePreference: { orientation: 'square', relativeSize: 'small' } }
}
```

- [ ] **Step 8: Daily Quote**

Replace `frontend/src/integrations/daily-quote/useWidgetMeta.ts`:

```typescript
import type { WidgetMeta } from '@/lib/widget-types'

export function useDailyQuoteWidgetMeta(): WidgetMeta {
  return { visible: true, priority: 0, sizePreference: { orientation: 'square', relativeSize: 'small' } }
}
```

- [ ] **Step 9: Trivia**

Replace `frontend/src/integrations/trivia/useWidgetMeta.ts`:

```typescript
import type { WidgetMeta } from '@/lib/widget-types'

export function useTriviaWidgetMeta(): WidgetMeta {
  return { visible: true, priority: 0, sizePreference: { orientation: 'square', relativeSize: 'small' } }
}
```

- [ ] **Step 10: Jokes**

Replace `frontend/src/integrations/jokes/useWidgetMeta.ts`:

```typescript
import type { WidgetMeta } from '@/lib/widget-types'

export function useJokeWidgetMeta(): WidgetMeta {
  return { visible: true, priority: 0, sizePreference: { orientation: 'square', relativeSize: 'small' } }
}
```

- [ ] **Step 11: Calendar (new file)**

Create `frontend/src/integrations/google-calendar/useWidgetMeta.ts`:

```typescript
import type { WidgetMeta } from '@/lib/widget-types'

export function useCalendarWidgetMeta(): WidgetMeta {
  return {
    visible: true,
    priority: 100,
    sizePreference: { orientation: 'vertical', relativeSize: 'large' },
    anchor: { column: 1, row: 1 },
  }
}
```

- [ ] **Step 12: Commit**

```bash
git add frontend/src/integrations/*/useWidgetMeta.ts
git commit -m "refactor: update all widget meta hooks to use sizePreference"
```

---

## Chunk 4: Rewrite HomeBoard

### Task 5: Rewrite HomeBoard to use CellGridLayout with calendar as grid widget

**Files:**
- Modify: `frontend/src/boards/HomeBoard.tsx`

- [ ] **Step 1: Rewrite the file**

Key changes:
- Remove imports for `MagazineLayout`, `GridLayout`, `MagazineWidget`
- Remove `useLayoutMode` hook (no more grid vs magazine distinction)
- Remove `MAX_WIDGET_SLOTS` constant
- Add imports for `CellGridLayout`, `CellGridWidget`, `useCalendarWidgetMeta`
- Add `useGridConfig` hook to read `dashboard.columns` and `dashboard.rows` from config
- Calendar becomes a widget in the grid (passes its element with data from `useGoogleCalendar`)
- Filler distribution uses `placeWidgets` to compute free cells instead of `MAX_WIDGET_SLOTS`
- Hero strip still uses calendar data from `useGoogleCalendar` (same as before)

Replace the imports section at the top. Remove:

```typescript
import { GridLayout } from './layouts/GridLayout'
import { MagazineLayout } from './layouts/MagazineLayout'
import type { MagazineWidget } from './layouts/MagazineLayout'
```

Add:

```typescript
import { CellGridLayout } from './layouts/CellGridLayout'
import type { CellGridWidget } from './layouts/CellGridLayout'
import { placeWidgets, computeSpan, countFreeCells } from './layouts/gridEngine'
import type { GridConfig, GridWidget } from './layouts/gridEngine'
import { useCalendarWidgetMeta } from '@/integrations/google-calendar/useWidgetMeta'
```

Remove `MAX_WIDGET_SLOTS`, `FILLER_PRIORITY`, and `useLayoutMode`.

Add `useGridConfig`:

```typescript
function useGridConfig(): { columns: number; rows: number } {
  const [config, setConfig] = useState({ columns: 6, rows: 4 })

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        const cols = parseInt(data['dashboard.columns'] ?? '6', 10) || 6
        const rows = parseInt(data['dashboard.rows'] ?? '4', 10) || 4
        setConfig({ columns: cols, rows: rows })
      })
      .catch(() => {})
  }, [])

  return config
}
```

Rewrite the `Widgets` function:

```typescript
function Widgets({
  grid,
  calendarDays,
  calendarLoading,
  calendarError,
  calendarRefetch,
}: {
  grid: { columns: number; rows: number }
  calendarDays: CalendarDay[] | null
  calendarLoading: boolean
  calendarError: string | null
  calendarRefetch: () => Promise<void>
}) {
  const calendarMeta = useCalendarWidgetMeta()
  const sportsMeta = useSportsWidgetMeta()
  const packagesMeta = usePackagesWidgetMeta()
  const choresMeta = useChoresWidgetMeta()
  const countdownsMeta = useCountdownsWidgetMeta()
  const lunchMeta = useLunchWidgetMeta()
  const onThisDayMeta = useOnThisDayWidgetMeta()
  const wordMeta = useWordOfTheDayWidgetMeta()
  const quoteMeta = useDailyQuoteWidgetMeta()
  const triviaMeta = useTriviaWidgetMeta()
  const jokeMeta = useJokeWidgetMeta()

  const calendarElement = (
    <CalendarWidget
      days={calendarDays}
      isLoading={calendarLoading}
      error={calendarError}
      refetch={calendarRefetch}
    />
  )

  const contentWidgets: CellGridWidget[] = [
    { key: 'calendar', element: calendarElement, meta: calendarMeta },
    { key: 'sports', element: <SportsWidget />, meta: sportsMeta },
    { key: 'packages', element: <PackagesWidget />, meta: packagesMeta },
    { key: 'countdowns', element: <CountdownsWidget />, meta: countdownsMeta },
    { key: 'chores', element: <ChoresWidget />, meta: choresMeta },
    { key: 'lunch', element: <LunchMenuWidget />, meta: lunchMeta },
  ]

  const fillerWidgets: CellGridWidget[] = [
    { key: 'on-this-day', element: <OnThisDayWidget />, meta: onThisDayMeta },
    { key: 'word-of-the-day', element: <WordOfTheDayWidget />, meta: wordMeta },
    { key: 'daily-quote', element: <DailyQuoteWidget />, meta: quoteMeta },
    { key: 'trivia', element: <TriviaWidget />, meta: triviaMeta },
    { key: 'jokes', element: <JokeWidget />, meta: jokeMeta },
  ]

  const visibleContent = contentWidgets.filter((w) => w.meta.visible)
  const visibleFillers = fillerWidgets.filter((w) => w.meta.visible)

  // Compute how many cells fillers can use by doing a dry run with content only
  const gridConfig: GridConfig = { columns: grid.columns, rows: grid.rows }
  const contentOnly = visibleContent.filter(
    (w): w is CellGridWidget & { meta: { visible: true } } => w.meta.visible,
  ) as GridWidget[]
  const { freeCells: cellsAfterContent } = placeWidgets(contentOnly, gridConfig)

  // Estimate how many filler slots we have (each filler is small = ~1 cell)
  const smallSpan = computeSpan({ orientation: 'square', relativeSize: 'small' }, gridConfig)
  const cellsPerFiller = smallSpan.colSpan * smallSpan.rowSpan
  const fillerSlots = Math.floor(cellsAfterContent / cellsPerFiller)

  let widgets: CellGridWidget[]
  if (fillerSlots === 0) {
    widgets = visibleContent
  } else if (fillerSlots >= visibleFillers.length) {
    widgets = [...visibleContent, ...visibleFillers]
  } else if (fillerSlots === 1) {
    const metaElement = (
      <MetaFillerWidget
        fillers={visibleFillers.map((f) => ({ key: f.key, element: f.element }))}
      />
    )
    widgets = [
      ...visibleContent,
      { key: 'meta-filler', element: metaElement, meta: { visible: true, priority: 0, sizePreference: { orientation: 'square', relativeSize: 'small' } } },
    ]
  } else {
    const individual = visibleFillers.slice(0, fillerSlots - 1)
    const overflow = visibleFillers.slice(fillerSlots - 1)
    const metaElement = (
      <MetaFillerWidget
        fillers={overflow.map((f) => ({ key: f.key, element: f.element }))}
      />
    )
    widgets = [
      ...visibleContent,
      ...individual,
      { key: 'meta-filler', element: metaElement, meta: { visible: true, priority: 0, sizePreference: { orientation: 'square', relativeSize: 'small' } } },
    ]
  }

  return <CellGridLayout widgets={widgets} columns={grid.columns} rows={grid.rows} />
}
```

Update `HomeBoard`:

```typescript
export function HomeBoard() {
  const calendar = useGoogleCalendar()
  const grid = useGridConfig()

  const allEvents = (calendar.data ?? []).flatMap((d) => d.events)
  const driveInfo = useDrivingTime(allEvents)
  const heroEvents = getHeroEvents(calendar.data, driveInfo)

  return (
    <div className="flex flex-col gap-[var(--spacing-grid-gap)] h-full">
      <TimerBanner />
      <HeroStripWithData heroEvents={heroEvents} />
      <Widgets
        grid={grid}
        calendarDays={calendar.data}
        calendarLoading={calendar.isLoading}
        calendarError={calendar.error?.message ?? null}
        calendarRefetch={calendar.refetch}
      />
    </div>
  )
}
```

Remove the old `<div className="flex gap...">` wrapper that split calendar from widgets — the grid handles everything now.

Also remove unused imports: `WidgetSize`, `useWidgetMaxSizes`, old layout-related imports.

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/boards/HomeBoard.tsx
git commit -m "feat: rewrite HomeBoard to use CellGridLayout with calendar as grid widget"
```

---

## Chunk 5: Settings and Cleanup

### Task 6: Update DashboardSettings

**Files:**
- Modify: `frontend/src/integrations/dashboard/DashboardSettings.tsx`

- [ ] **Step 1: Replace layout picker with rows/columns settings**

Remove the layout radio buttons (grid vs magazine). Replace with two number inputs for rows and columns. Remove the per-widget maxSize section (no longer applicable — the grid engine handles sizing).

The save function writes `dashboard.columns` and `dashboard.rows` to config.

```typescript
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/ui/Button'

export function DashboardSettings() {
  const [columns, setColumns] = useState('6')
  const [rows, setRows] = useState('4')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const config = await fetch('/api/config').then((r) => r.json()) as Record<string, string>
      setColumns(config['dashboard.columns'] ?? '6')
      setRows(config['dashboard.rows'] ?? '4')
    } catch {
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    try {
      setError(null)
      await fetch(`/api/config/${encodeURIComponent('dashboard.columns')}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: columns }),
      })
      await fetch(`/api/config/${encodeURIComponent('dashboard.rows')}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: rows }),
      })
      setStatus('Saved!')
      setTimeout(() => setStatus(null), 2000)
    } catch {
      setError('Failed to save settings')
    }
  }

  if (loading) {
    return <div className="text-text-muted text-sm">Loading...</div>
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-error/10 text-error rounded-lg p-3 text-sm">{error}</div>
      )}

      <div>
        <label className="text-xs text-text-muted block mb-2">Grid Columns</label>
        <input
          type="number"
          min="2"
          max="12"
          value={columns}
          onChange={(e) => setColumns(e.target.value)}
          className="w-24 px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
        />
        <div className="text-xs text-text-muted mt-1">Number of columns in the widget grid (default: 6)</div>
      </div>

      <div>
        <label className="text-xs text-text-muted block mb-2">Grid Rows</label>
        <input
          type="number"
          min="2"
          max="8"
          value={rows}
          onChange={(e) => setRows(e.target.value)}
          className="w-24 px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
        />
        <div className="text-xs text-text-muted mt-1">Number of rows in the widget grid (default: 4)</div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave}>Save</Button>
        {status && <span className="text-sm text-success">{status}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/integrations/dashboard/DashboardSettings.tsx
git commit -m "feat(settings): replace layout picker with grid rows/columns config"
```

---

### Task 7: Remove old layout files and clean up

**Files:**
- Delete: `frontend/src/boards/layouts/MagazineLayout.tsx`
- Delete: `frontend/src/boards/layouts/GridLayout.tsx`

- [ ] **Step 1: Delete old layout files**

```bash
rm frontend/src/boards/layouts/MagazineLayout.tsx frontend/src/boards/layouts/GridLayout.tsx
```

- [ ] **Step 2: Check for stale imports**

Search for any remaining imports of the old layouts:

```bash
grep -r "MagazineLayout\|GridLayout\|MagazineWidget" frontend/src/ --include="*.ts" --include="*.tsx"
```

Fix any found references. The main ones should already be removed in Task 5 (HomeBoard).

- [ ] **Step 3: Verify full build**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add -A frontend/src/boards/layouts/
git commit -m "refactor: remove old MagazineLayout and GridLayout"
```

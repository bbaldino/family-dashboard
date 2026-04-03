# Widget Sizing Port Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port adaptive widget sizing to all dashboard widgets — each widget declares visibility and size preference via a `useWidgetMeta` hook, the layout engine filters invisible widgets, and each widget renders compact/standard/expanded variants.

**Architecture:** Replace the `WidgetMeta` interface with a discriminated union (`visible: false` | `visible: true` + size/priority). Each widget gets a `useWidgetMeta` hook that inspects its data. The layout engine filters invisible widgets before resolving layout. Widgets accept a `size` prop and render variant-specific content, using `WidgetCard`'s `detail` prop for tap-to-expand on compact cards.

**Tech Stack:** React, TypeScript, TanStack React Query

**Spec:** `docs/specs/2026-04-03-widget-sizing-port-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `frontend/src/integrations/packages/useWidgetMeta.ts` | Packages visibility + priority by shipment state |
| `frontend/src/integrations/chores/useWidgetMeta.ts` | Chores visibility based on assignments |
| `frontend/src/integrations/countdowns/useWidgetMeta.ts` | Countdowns visibility based on upcoming events |
| `frontend/src/integrations/nutrislice/useWidgetMeta.ts` | Lunch menu visibility + expanded preference when data exists |
| `frontend/src/integrations/on-this-day/useWidgetMeta.ts` | Always visible, always standard, priority 0 |

### Modified files

| File | Change |
|------|--------|
| `frontend/src/lib/widget-types.ts` | Replace `WidgetMeta` with discriminated union |
| `frontend/src/boards/layouts/MagazineLayout.tsx` | Filter invisible widgets, remove `supportedSizes` check |
| `frontend/src/boards/HomeBoard.tsx` | Wire all meta hooks, remove `DEFAULT_WIDGET_META` usage |
| `frontend/src/integrations/sports/useWidgetMeta.ts` | Adapt to new `WidgetMeta` shape |
| `frontend/src/integrations/packages/PackagesWidget.tsx` | Accept `size` prop, render compact variant |
| `frontend/src/integrations/chores/ChoresWidget.tsx` | Accept `size` prop, render compact variant |
| `frontend/src/integrations/countdowns/CountdownsWidget.tsx` | Accept `size` prop, render compact variant |
| `frontend/src/integrations/nutrislice/LunchMenuWidget.tsx` | Accept `size` prop, render compact + expanded variants |
| `frontend/src/integrations/on-this-day/OnThisDayWidget.tsx` | Accept `size` prop, render compact variant |

---

## Chunk 1: Update Core Types and Layout Engine

### Task 1: Replace WidgetMeta with discriminated union

**Files:**
- Modify: `frontend/src/lib/widget-types.ts`

- [ ] **Step 1: Replace the types**

Replace the entire contents of `widget-types.ts`:

```typescript
export type WidgetSize = 'compact' | 'standard' | 'expanded'

export type WidgetMeta =
  | { visible: false }
  | { visible: true; preferredSize: WidgetSize; priority: number }

/** Default metadata for widgets that don't have a useWidgetMeta hook yet */
export const DEFAULT_WIDGET_META: WidgetMeta = {
  visible: true,
  preferredSize: 'standard',
  priority: 0,
}
```

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

This will fail — `MagazineLayout.tsx` and `useWidgetMeta.ts` reference the old shape. That's expected; we fix them next.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/widget-types.ts
git commit -m "refactor: replace WidgetMeta with visible/invisible discriminated union"
```

---

### Task 2: Update MagazineLayout to handle new WidgetMeta

**Files:**
- Modify: `frontend/src/boards/layouts/MagazineLayout.tsx`

- [ ] **Step 1: Update MagazineWidget interface and resolveLayout**

The `MagazineWidget.meta` field now uses the union type. The layout engine must filter out invisible widgets and no longer checks `supportedSizes`.

Replace the `resolveLayout` function:

```typescript
function resolveLayout(widgets: MagazineWidget[]): LayoutConfig {
  // Filter to visible widgets only
  const visible = widgets.filter((w): w is MagazineWidget & { meta: { visible: true } } => w.meta.visible)

  // Sort by priority descending
  const sorted = [...visible].sort((a, b) => b.meta.priority - a.meta.priority)

  // Cap preferred sizes at user maxSize
  const capped = sorted.map((w) => ({
    ...w,
    effectivePreferred: capSize(w.meta.preferredSize, w.maxSize),
  }))

  // Check if any widget wants expanded
  const expandedCandidate = capped.find(
    (w) => w.effectivePreferred === 'expanded',
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

Also update the equal-rows grid to be dynamic based on widget count instead of hardcoded 3×2. Replace the equal-rows render in `MagazineLayout`:

```typescript
  if (layout.type === 'equal-rows') {
    const count = layout.widgets.length
    const cols = count <= 2 ? count : 3
    const rows = Math.ceil(count / cols)
    return (
      <div
        className="flex-1 grid gap-[var(--spacing-grid-gap)] min-h-0"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gridAutoFlow: 'dense' }}
      >
        {layout.widgets.map(renderWithSize)}
      </div>
    )
  }
```

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

May still fail on `useWidgetMeta.ts` — that's fixed in Task 3.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/boards/layouts/MagazineLayout.tsx
git commit -m "refactor: layout engine filters invisible widgets, dynamic grid sizing"
```

---

### Task 3: Update sports useWidgetMeta for new type shape

**Files:**
- Modify: `frontend/src/integrations/sports/useWidgetMeta.ts`

- [ ] **Step 1: Adapt to discriminated union**

Replace the entire file:

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
    return { visible: true, preferredSize: 'expanded', priority: 10 }
  }
  if (hasUpcomingToday) {
    return { visible: true, preferredSize: 'expanded', priority: 5 }
  }
  if (hasUpcoming) {
    return { visible: true, preferredSize: 'standard', priority: 3 }
  }
  if (hasFinal) {
    return { visible: true, preferredSize: 'standard', priority: 2 }
  }

  return { visible: true, preferredSize: 'standard', priority: 1 }
}
```

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

Should pass now — all references to the old `WidgetMeta` shape are updated.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/integrations/sports/useWidgetMeta.ts
git commit -m "refactor(sports): adapt useWidgetMeta to discriminated union type"
```

---

## Chunk 2: Widget Meta Hooks

### Task 4: Packages useWidgetMeta

**Files:**
- Create: `frontend/src/integrations/packages/useWidgetMeta.ts`

- [ ] **Step 1: Create the meta hook**

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

  const hasDeliveryToday = visible.some((s) => {
    if (s.status !== 'out_for_delivery') return false
    return true
  })

  return {
    visible: true,
    preferredSize: 'standard',
    priority: hasDeliveryToday ? 5 : 3,
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
git add frontend/src/integrations/packages/useWidgetMeta.ts
git commit -m "feat(packages): add useWidgetMeta hook with delivery-day priority"
```

---

### Task 5: Chores useWidgetMeta

**Files:**
- Create: `frontend/src/integrations/chores/useWidgetMeta.ts`

- [ ] **Step 1: Create the meta hook**

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

  return { visible: true, preferredSize: 'standard', priority: 4 }
}
```

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/integrations/chores/useWidgetMeta.ts
git commit -m "feat(chores): add useWidgetMeta hook"
```

---

### Task 6: Countdowns useWidgetMeta

**Files:**
- Create: `frontend/src/integrations/countdowns/useWidgetMeta.ts`

- [ ] **Step 1: Create the meta hook**

```typescript
import type { WidgetMeta } from '@/lib/widget-types'
import { useCountdowns } from './useCountdowns'

export function useCountdownsWidgetMeta(): WidgetMeta {
  const { data } = useCountdowns()
  const items = data ?? []

  if (items.length === 0) {
    return { visible: false }
  }

  return { visible: true, preferredSize: 'standard', priority: 2 }
}
```

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/integrations/countdowns/useWidgetMeta.ts
git commit -m "feat(countdowns): add useWidgetMeta hook"
```

---

### Task 7: Lunch menu useWidgetMeta

**Files:**
- Create: `frontend/src/integrations/nutrislice/useWidgetMeta.ts`

- [ ] **Step 1: Create the meta hook**

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
    return { visible: true, preferredSize: 'expanded', priority: 4 }
  }

  // Tomorrow only
  return { visible: true, preferredSize: 'standard', priority: 2 }
}
```

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/integrations/nutrislice/useWidgetMeta.ts
git commit -m "feat(nutrislice): add useWidgetMeta hook with expanded preference"
```

---

### Task 8: On This Day useWidgetMeta

**Files:**
- Create: `frontend/src/integrations/on-this-day/useWidgetMeta.ts`

- [ ] **Step 1: Create the meta hook**

```typescript
import type { WidgetMeta } from '@/lib/widget-types'

export function useOnThisDayWidgetMeta(): WidgetMeta {
  return { visible: true, preferredSize: 'standard', priority: 0 }
}
```

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/integrations/on-this-day/useWidgetMeta.ts
git commit -m "feat(on-this-day): add useWidgetMeta hook (always visible, low priority)"
```

---

### Task 9: Wire all meta hooks into HomeBoard

**Files:**
- Modify: `frontend/src/boards/HomeBoard.tsx`

- [ ] **Step 1: Replace DEFAULT_WIDGET_META usage with per-widget hooks**

Update imports — remove `DEFAULT_WIDGET_META`, add new hooks:

```typescript
import { usePackagesWidgetMeta } from '@/integrations/packages/useWidgetMeta'
import { useChoresWidgetMeta } from '@/integrations/chores/useWidgetMeta'
import { useCountdownsWidgetMeta } from '@/integrations/countdowns/useWidgetMeta'
import { useLunchWidgetMeta } from '@/integrations/nutrislice/useWidgetMeta'
import { useOnThisDayWidgetMeta } from '@/integrations/on-this-day/useWidgetMeta'
```

Remove the `DEFAULT_WIDGET_META` import line.

Replace the `Widgets` function:

```typescript
function Widgets({ layout }: { layout: LayoutMode }) {
  const sportsMeta = useSportsWidgetMeta()
  const packagesMeta = usePackagesWidgetMeta()
  const choresMeta = useChoresWidgetMeta()
  const countdownsMeta = useCountdownsWidgetMeta()
  const lunchMeta = useLunchWidgetMeta()
  const onThisDayMeta = useOnThisDayWidgetMeta()
  const maxSizes = useWidgetMaxSizes()

  const widgets: MagazineWidget[] = [
    { key: 'sports', element: <SportsWidget />, meta: sportsMeta, maxSize: maxSizes['sports'] },
    { key: 'packages', element: <PackagesWidget />, meta: packagesMeta, maxSize: maxSizes['packages'] },
    { key: 'countdowns', element: <CountdownsWidget />, meta: countdownsMeta, maxSize: maxSizes['countdowns'] },
    { key: 'chores', element: <ChoresWidget />, meta: choresMeta, maxSize: maxSizes['chores'] },
    { key: 'lunch', element: <LunchMenuWidget />, meta: lunchMeta, maxSize: maxSizes['lunch'] },
    { key: 'on-this-day', element: <OnThisDayWidget />, meta: onThisDayMeta, maxSize: maxSizes['on-this-day'] },
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

- [ ] **Step 3: Test visually**

Open the dashboard. Widgets with no data should disappear. Widgets with data should render at standard in equal-rows (assuming no live sports or today's lunch data triggering expanded).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/boards/HomeBoard.tsx
git commit -m "feat: wire all widget meta hooks into HomeBoard"
```

---

## Chunk 3: Compact Variants

### Task 10: Packages compact variant

**Files:**
- Modify: `frontend/src/integrations/packages/PackagesWidget.tsx`

- [ ] **Step 1: Add size prop and compact render**

Add the import and prop:

```typescript
import type { WidgetSize } from '@/lib/widget-types'
```

Change the function signature:

```typescript
interface PackagesWidgetProps {
  size?: WidgetSize
}

export function PackagesWidget({ size = 'standard' }: PackagesWidgetProps) {
```

After the existing sorting logic (after `const activeCount = active.length`), add the compact render. Insert this before the loading/error checks:

```typescript
  if (size === 'compact') {
    const compactShipments = active.slice(0, 3)
    return (
      <WidgetCard
        title="Packages"
        category="grocery"
        badge={activeCount > 0 ? `${activeCount} active` : undefined}
        detail={
          <div className="flex flex-col">
            {active.map((shipment) => (
              <ShipmentRow key={shipment.id} shipment={shipment} />
            ))}
            {delivered.length > 0 && (
              <>
                <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.3px] pt-[6px] mt-[4px]">
                  Recently delivered
                </div>
                {delivered.map((shipment) => (
                  <ShipmentRow key={shipment.id} shipment={shipment} />
                ))}
              </>
            )}
          </div>
        }
      >
        <div className="flex flex-col">
          {compactShipments.map((shipment) => (
            <div
              key={shipment.id}
              className="flex items-center justify-between py-1 border-b border-border last:border-b-0 text-xs"
            >
              <span className="text-text-primary truncate mr-2">{shipment.name}</span>
              <span className="text-text-secondary whitespace-nowrap">
                {STATUS_LABELS[shipment.status]}
              </span>
            </div>
          ))}
        </div>
      </WidgetCard>
    )
  }
```

Also add the import for `STATUS_LABELS`:

```typescript
import { STATUS_LABELS } from './types'
```

Note: the `detail` prop on `WidgetCard` makes the compact card tappable — it opens a BottomSheet showing the full standard content.

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/integrations/packages/PackagesWidget.tsx
git commit -m "feat(packages): add compact variant with tap-to-expand"
```

---

### Task 11: Chores compact variant

**Files:**
- Modify: `frontend/src/integrations/chores/ChoresWidget.tsx`

- [ ] **Step 1: Add size prop and compact render**

Add the import:

```typescript
import type { WidgetSize } from '@/lib/widget-types'
```

Change the function signature:

```typescript
interface ChoresWidgetProps {
  size?: WidgetSize
}

export function ChoresWidget({ size = 'standard' }: ChoresWidgetProps) {
```

After `const persons = data?.persons ?? []`, before the standard return, add the compact render:

```typescript
  if (size === 'compact') {
    return (
      <WidgetCard
        title="Chores"
        category="chores"
        badge={badge}
        className="h-full"
        visible={persons.length > 0}
        detail={
          <div className="flex flex-col gap-3">
            {persons.map((pa) => (
              <PersonSection
                key={pa.person.id}
                personAssignments={pa}
                onComplete={completeAssignment}
                onUncomplete={uncompleteAssignment}
                onOpenPicker={(assignmentId, pickFromTags, currentPickId) =>
                  setPicker({ assignmentId, pickFromTags, currentPickId })
                }
              />
            ))}
          </div>
        }
      >
        <div className="flex flex-col gap-1">
          {persons.map((pa) => {
            const done = pa.assignments.filter((a) => a.completed).length
            const total = pa.assignments.length
            return (
              <div key={pa.person.id} className="flex items-center gap-2 text-xs">
                {pa.person.avatar ? (
                  <img src={pa.person.avatar} alt="" className="w-4 h-4 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ background: pa.person.color }}
                  >
                    {pa.person.name[0].toUpperCase()}
                  </div>
                )}
                <span className="text-text-primary">{pa.person.name}:</span>
                <span className={done === total ? 'text-success' : 'text-text-secondary'}>
                  {done}/{total} done
                </span>
              </div>
            )
          })}
        </div>
      </WidgetCard>
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
git add frontend/src/integrations/chores/ChoresWidget.tsx
git commit -m "feat(chores): add compact variant with summary per person"
```

---

### Task 12: Countdowns compact variant

**Files:**
- Modify: `frontend/src/integrations/countdowns/CountdownsWidget.tsx`

- [ ] **Step 1: Add size prop and compact render**

Add the import:

```typescript
import type { WidgetSize } from '@/lib/widget-types'
```

Change the function signature:

```typescript
interface CountdownsWidgetProps {
  size?: WidgetSize
}

export function CountdownsWidget({ size = 'standard' }: CountdownsWidgetProps) {
```

After the error check, before the standard return, add the compact render:

```typescript
  const items = data ?? []

  if (size === 'compact') {
    return (
      <WidgetCard
        title="Coming Up"
        category="info"
        detail={
          items.length > 0 ? (
            <div className="flex flex-col">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-[5px] border-b border-border last:border-b-0"
                >
                  <span className="text-[14px] text-text-primary truncate mr-2">{item.name}</span>
                  <span className={`text-[16px] font-semibold whitespace-nowrap ${item.daysUntil === 0 ? 'text-success' : 'text-info'}`}>
                    {formatDays(item.daysUntil)}
                  </span>
                </div>
              ))}
            </div>
          ) : undefined
        }
      >
        <div className="flex flex-col">
          {items.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-1 text-xs"
            >
              <span className="text-text-primary truncate mr-2">{item.name}</span>
              <span className={`font-semibold whitespace-nowrap ${item.daysUntil === 0 ? 'text-success' : 'text-info'}`}>
                {formatDays(item.daysUntil)}
              </span>
            </div>
          ))}
        </div>
      </WidgetCard>
    )
  }
```

Also move the `const items = data ?? []` line up before the compact check (it currently sits after the error check in the standard render — move it to be shared).

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/integrations/countdowns/CountdownsWidget.tsx
git commit -m "feat(countdowns): add compact variant showing top 3 events"
```

---

### Task 13: On This Day compact variant

**Files:**
- Modify: `frontend/src/integrations/on-this-day/OnThisDayWidget.tsx`

- [ ] **Step 1: Add size prop and compact render**

Add the import:

```typescript
import type { WidgetSize } from '@/lib/widget-types'
```

Change the function signature:

```typescript
interface OnThisDayWidgetProps {
  size?: WidgetSize
}

export function OnThisDayWidget({ size = 'standard' }: OnThisDayWidgetProps) {
```

After the loading/empty check, before the standard return, add the compact render:

```typescript
  const event = events[index % events.length]

  if (size === 'compact') {
    return (
      <WidgetCard
        title="On This Day"
        category="info"
        detail={
          <div className="flex flex-col gap-2">
            <div className="text-4xl font-extrabold text-palette-3 leading-none tracking-tight">
              {event.year}
            </div>
            <p className="text-text-primary text-sm leading-relaxed">{event.text}</p>
            <button
              onClick={(e) => { e.stopPropagation(); advance() }}
              className="self-end p-1.5 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-primary transition-colors"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-1">
          <div className="text-xl font-extrabold text-palette-3 leading-none">{event.year}</div>
          <p className="text-text-primary text-xs leading-snug line-clamp-2">{event.text}</p>
        </div>
      </WidgetCard>
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
git add frontend/src/integrations/on-this-day/OnThisDayWidget.tsx
git commit -m "feat(on-this-day): add compact variant with truncated text"
```

---

### Task 14: Lunch menu compact variant

**Files:**
- Modify: `frontend/src/integrations/nutrislice/LunchMenuWidget.tsx`

- [ ] **Step 1: Add size prop and compact render**

Add the import:

```typescript
import type { WidgetSize } from '@/lib/widget-types'
```

Change the function signature:

```typescript
interface LunchMenuWidgetProps {
  size?: WidgetSize
}

export function LunchMenuWidget({ size = 'standard' }: LunchMenuWidgetProps) {
```

After the error check, before the standard return, add the compact render. Compact shows one day only — today if available, otherwise tomorrow. Main entrees only, no alternatives or extras:

```typescript
  if (size === 'compact') {
    const compactDay = data?.today ?? data?.tomorrow
    const compactLabel = data?.today ? 'Today' : 'Tomorrow'
    const mainEntries = compactDay?.entries.filter((e) => !e.isAlternative) ?? []

    return (
      <WidgetCard
        title="Lunch Menu"
        category="food"
        visible={hasMenu}
        detail={
          hasToday ? (
            <div className="flex flex-col gap-[6px]">
              <MenuDaySection day={data!.today!} label="Today" />
              {hasTomorrow && (
                <>
                  <div className="border-t border-border" />
                  <MenuDaySection day={data!.tomorrow!} label="Tomorrow" compact />
                </>
              )}
            </div>
          ) : hasTomorrow ? (
            <MenuDaySection day={data!.tomorrow!} label="Tomorrow" />
          ) : undefined
        }
      >
        {compactDay && (
          <div>
            <div className="text-[10px] font-bold text-palette-4 uppercase tracking-[0.5px] mb-1">
              {compactLabel}
            </div>
            <div className="flex flex-col gap-0.5">
              {mainEntries.slice(0, 4).map((entry, i) => (
                <div key={i} className="flex items-center gap-1 text-xs">
                  <span className="w-1 h-1 rounded-full bg-palette-4 flex-shrink-0" />
                  <span className="text-text-primary truncate">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </WidgetCard>
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
git add frontend/src/integrations/nutrislice/LunchMenuWidget.tsx
git commit -m "feat(nutrislice): add compact variant with single-day entrees"
```

---

## Chunk 4: Lunch Menu Expanded Variant

### Task 15: Extend lunch menu data hook to fetch weekly data

**Files:**
- Modify: `frontend/src/integrations/nutrislice/useLunchMenu.ts`

- [ ] **Step 1: Add week days to the data model and fetcher**

Add a `week` field to `LunchMenuData`:

```typescript
export interface LunchMenuData {
  today: LunchMenuDay | null
  tomorrow: LunchMenuDay | null
  week: LunchMenuDay[]
}
```

Update the `fetchMenu` function to populate `week` — the NutriSlice API already returns a full week. After the existing `today`/`tomorrow` parsing, add:

```typescript
  const week: LunchMenuDay[] = (data.days ?? [])
    .map((d: NutriSliceDay) => parseDayMenu(d))
    .filter((d: LunchMenuDay | null): d is LunchMenuDay => d != null)
    .filter((d: LunchMenuDay) => {
      const dayDate = new Date(d.date + 'T12:00:00')
      dayDate.setHours(0, 0, 0, 0)
      const todayDate = new Date()
      todayDate.setHours(0, 0, 0, 0)
      return dayDate >= todayDate
    })
    .slice(0, 5)

  return {
    today: parseDayMenu(todayData),
    tomorrow: parseDayMenu(tomorrowData),
    week,
  }
```

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/integrations/nutrislice/useLunchMenu.ts
git commit -m "feat(nutrislice): include weekly menu data for expanded view"
```

---

### Task 16: Lunch menu expanded render

**Files:**
- Modify: `frontend/src/integrations/nutrislice/LunchMenuWidget.tsx`

- [ ] **Step 1: Add expanded render**

After the compact check, before the standard return, add the expanded render:

```typescript
  if (size === 'expanded') {
    const days = data?.week ?? []
    return (
      <WidgetCard title="Lunch Menu" category="food" visible={hasMenu}>
        {days.length === 0 ? (
          <div className="text-[13px] text-text-muted py-1">No menu available</div>
        ) : (
          <div className="flex flex-col gap-[6px]">
            {days.map((day, i) => (
              <div key={day.date}>
                {i > 0 && <div className="border-t border-border mb-[6px]" />}
                <MenuDaySection day={day} label={day.dayName} compact={i > 0} />
              </div>
            ))}
          </div>
        )}
      </WidgetCard>
    )
  }
```

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 3: Test visually**

Temporarily hardcode `preferredSize: 'expanded'` and `priority: 10` in `nutrislice/useWidgetMeta.ts`. Open the dashboard in magazine mode — lunch should take the hero slot showing up to 5 days. Revert the hardcoding after testing.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/integrations/nutrislice/LunchMenuWidget.tsx
git commit -m "feat(nutrislice): add expanded variant showing 5-day menu"
```

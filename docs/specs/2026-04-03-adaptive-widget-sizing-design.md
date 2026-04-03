# Adaptive Widget Sizing Design

**Goal:** Allow widgets to render at different sizes (compact, standard, expanded) and let the magazine layout engine dynamically assign sizes based on widget priority, content state, and user preferences.

**Proof-of-concept widget:** Sports

---

## Widget Size Protocol

Each adaptive widget exports a `useWidgetMeta()` hook that returns reactive metadata:

```typescript
type WidgetSize = 'compact' | 'standard' | 'expanded'

interface WidgetMeta {
  supportedSizes: WidgetSize[]  // what the widget can render
  preferredSize: WidgetSize     // what it wants right now (content-driven)
  priority: number              // higher = claims space first
  anchor?: 'left'               // fixed position, removed from flexible pool
}
```

The layout passes the resolved size back as a prop:

```tsx
<SportsWidget size="expanded" />
```

Widgets that don't support adaptive sizing ignore the `size` prop and render their single layout (backwards compatible). Non-adaptive widgets implicitly have `supportedSizes: ['standard']`, `preferredSize: 'standard'`, `priority: 0`.

### User `maxSize` Override

Per-widget config key: `dashboard.widget.<widget-id>.maxSize` (e.g., `dashboard.widget.on-this-day.maxSize = compact`). Caps the widget's `preferredSize` before the layout engine sees it. If not set, no cap.

---

## Layout Engine

Lives in the Magazine layout component. The Grid layout ignores all metadata and passes `standard` to everything.

### Algorithm

1. **Separate anchored widgets** — pull out any widget with `anchor` set (Calendar → `left`). Place them in fixed positions.
2. **Collect metadata** — for each remaining flexible widget, read `WidgetMeta`. Cap `preferredSize` at user's `maxSize` config if set.
3. **Sort by priority** (descending).
4. **Choose configuration:**
   - If any widget prefers `expanded` → **primary configuration**
   - Otherwise → **equal rows configuration**

### Primary Configuration

The highest-priority widget that prefers `expanded` gets the primary slot (large card). Remaining widgets fill around it based on count (N = remaining flexible widgets):

- N ≤ 2: sidebar stack next to primary, no shelf row
- N ≤ 5: 2 in sidebar, rest in shelf row
- N > 5: 2 in sidebar, rest in shelf (wraps if needed)

Sidebar widgets receive `compact` (they're in a narrow stacked column with limited height). Shelf widgets receive `standard`. Primary widget receives `expanded`.

### Equal Rows Configuration

No widget wants to be big. All flexible widgets render at `standard`, laid out in rows of 3 (same as current grid behavior within the right column).

### Layout Zones

```
┌──────────┬────────────────────────────────┐
│          │          PRIMARY               │
│  LEFT    │                    ┌───────────┤
│(anchored)│                    │ SIDEBAR   │
│          ├──────┬──────┬──────┤  (stack)  │
│          │SHELF │SHELF │SHELF │           │
└──────────┴──────┴──────┴──────┴───────────┘
```

These aren't fixed named slots — the layout engine determines the arrangement dynamically. Sidebar may not exist if there aren't enough widgets. The shelf row adapts to however many widgets remain.

---

## Sports Widget Variants

Sports renders differently based on `size` prop × game state.

### Compact

- **Upcoming:** "Dodgers vs Nationals · Today 10:05 AM" — single line
- **Live:** "Dodgers 3 - Nationals 1 · Top 5th" — score + situation
- **Final:** "Dodgers 5 - Nationals 2 · Final" — final score

### Standard (current layout)

- **Upcoming:** Team logos, names, records, time, broadcast
- **Live:** Logos, live score, period/clock, MLB situation
- **Final:** Logos, final score, winner highlighted

### Expanded

- **Upcoming:** Standard card PLUS upcoming schedule for tracked teams (next 2-3 games), team records. AI preview: 2-3 sentence matchup summary via local Ollama.
- **Live:** Standard card PLUS linescore (inning-by-inning / quarter-by-quarter), full leaders/stats, detailed play situation.
- **Final:** Standard card PLUS linescore, game leaders with full stats, notable performances.

### Priority by State

| Game State | Priority |
|---|---|
| Live game | 10 |
| Upcoming today | 5 |
| Upcoming tomorrow+ | 3 |
| Final (recent) | 2 |
| No games | 1 |

Priority is hardcoded per state, not user-configurable.

---

## AI Game Preview

Backend endpoint: `GET /api/sports/preview?game_id=<id>`

### Flow

1. Check cache — if a preview exists for this game and is fresh (< 24h for upcoming, permanent for final), return it.
2. Fetch ESPN data for the game: team records, recent results, standings context.
3. Send context to local Ollama with prompt: structured request for a 2-3 sentence family-friendly game preview covering matchup context, streaks, and any notable storylines.
4. Cache the result (in-memory or SQLite).
5. Return `{ summary: string }`.

### Configuration

`sports.ollama_url` in settings (e.g., `http://localhost:11434`). If not configured, AI previews are not shown — all other functionality works without it.

### Usage

- **Expanded widget:** 2-3 sentence preview below the game card.
- **Detail modal (future):** longer AI summary with more context (separate feature, out of scope).

---

## Scope

### In Scope

- `WidgetMeta` types and hook pattern
- Layout engine in Magazine layout (priority-based allocation algorithm)
- Sports widget: compact, standard, expanded variants for all game states
- AI preview backend endpoint with Ollama (cached, optional)
- User `maxSize` config per widget via `dashboard.widget.<id>.maxSize`
- Refactor existing Sports widget rendering into the `standard` variant (no behavior change for grid layout users)

### Out of Scope

- Adaptive sizing for other widgets — they render `standard` and ignore the size prop
- Detail modal AI deep-dive
- UI for configuring widget priorities
- Container queries within variants
- Enhanced ESPN data fetching (news, injuries beyond what scoreboard provides)

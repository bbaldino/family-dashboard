# Timers Integration Design

## Goal

Add a live timer display to the dashboard that shows active kitchen timers as a floating banner above the hero strip, with real-time countdown updates via SSE from an external timer service.

## Data Source

External timer service (configurable URL, default port 3380).

**Endpoints used:**
- `GET /timers/events` — SSE stream. Sends `snapshot` on connect, then `created`, `fired`, `cancelled`, `paused`, `resumed` events.
- `GET /timers/` — REST fallback to list all timers (used if SSE reconnects)
- `POST /timers/:id/pause` — pause a running timer
- `POST /timers/:id/resume` — resume a paused timer
- `DELETE /timers/:id` — cancel a timer

No authentication required (local network service).

## Architecture

### No backend changes

This is a `hasBackend: false` integration. The frontend connects directly to the timer service via SSE. No Rust proxy — SSE proxying adds unnecessary complexity for a same-network service.

### Frontend

**Integration registration:** Standard `defineIntegration` with `hasBackend: false` and a configurable `service_url` field (no default — user sets it in settings).

**`useTimers` hook:**
- Reads `service_url` from config
- Opens an `EventSource` to `{service_url}/timers/events`
- On `snapshot` event: replaces all timer state
- On individual events (`created`, `fired`, `cancelled`, `paused`, `resumed`): updates the specific timer
- Uses `setInterval` at 1-second ticks to decrement `remainingMs` locally for smooth countdown display
- Handles SSE reconnection (EventSource auto-reconnects on disconnect)
- Returns: `{ timers: Timer[], firedTimers: Timer[], pause(id), resume(id), cancel(id), dismiss(id) }`
- `firedTimers` tracks recently fired timers until dismissed by the user

**`TimerBanner` component:**
- Rendered in `HomeBoard` above the hero strip
- Only visible when there are active timers or undismissed fired timers
- When hidden (no timers), takes no space — the hero strip is at the top as usual

**Timer card states:**
- **Running:** orange-tinted card, countdown ticking, ⏸ pause and ✕ cancel buttons
- **Paused:** shows frozen time, ▶ resume and ✕ cancel buttons
- **Urgent (< 2 min remaining):** red-tinted card with pulse animation
- **Fired:** red banner with 🔔 bell, "[Name] timer is done!", Dismiss button

**Actions:** Pause, resume, cancel send requests directly to the timer service URL (not through the dashboard backend). Dismiss is local-only (removes the fired alert from the UI).

### Timer state types

```typescript
interface Timer {
  id: string
  name: string
  durationMs: number
  startedAt: string
  endsAt: string
  status: 'running' | 'paused' | 'fired' | 'cancelled'
  remainingMs: number
  pausedRemainingMs?: number
  createdAt: string
}

interface TimerEvent {
  type: 'snapshot' | 'created' | 'fired' | 'cancelled' | 'paused' | 'resumed'
  timer?: Timer
  timers?: Timer[]
}
```

### Config

```typescript
schema: z.object({
  service_url: z.string().optional(),
})
```

No default URL — user configures it in settings. If not configured, the banner simply doesn't appear (SSE won't connect).

## Visual Design

**Banner placement:** Between the top of the page and the hero strip. Uses the same warm aesthetic as the rest of the dashboard.

**Banner styling:**
- Orange gradient background (`palette-1` based) for normal timers
- Red gradient for fired/alert state
- Each timer in a frosted-glass card within the banner
- Countdown in large tabular-nums font
- Timer name in smaller muted text below
- Compact action buttons (pause/resume, cancel) per timer

**Urgency states:**
- Normal: orange-tinted card
- Urgent (< 2 minutes): red-tinted card with CSS pulse animation
- Fired: full red banner with bell icon and dismiss button

**Transitions:**
- Banner slides in when first timer becomes active
- Banner slides out when last timer is dismissed
- Individual timer cards can animate in/out as timers are added/removed

## Deferred

- Creating timers from the dashboard UI (timers are created via voice or other clients)
- Sound/audio alert when timer fires (would need browser audio API)
- Timer history view
- Multiple simultaneous fired timer alerts (v1 shows one at a time)

# Timers Integration Design

## Goal

Add a live timer display to the dashboard that shows active kitchen timers as a floating banner above the hero strip, with real-time countdown updates via SSE from an external timer service.

## Data Source

External timer service (configurable URL, default port 3380).

**Endpoints used:**
- `GET /timers/events` — SSE stream. Sends `snapshot` on connect (with all active timers), then `created`, `fired`, `cancelled`, `paused`, `resumed` events.
- `POST /timers/:id/pause` — pause a running timer
- `POST /timers/:id/resume` — resume a paused timer
- `DELETE /timers/:id` — cancel a timer

Note: `GET /timers/` (REST list) is not needed — the SSE snapshot provides initial state on every connect/reconnect. `POST /timers/` (create) is deferred.

No authentication required (local network service).

## Architecture

### No backend changes

This is a `hasBackend: false` integration. The frontend connects directly to the timer service via SSE. No Rust proxy — SSE proxying adds unnecessary complexity for a same-network service.

### Frontend

**Integration registration:** Standard `defineIntegration` with `hasBackend: false` and a configurable `service_url` field (no default — user sets it in settings).

**`useTimers` hook:**
- Reads `service_url` from config
- If not configured, returns empty state (no connection attempted)
- Opens an `EventSource` to `{service_url}/timers/events`
- On `snapshot` event: replaces all timer state with the active timers array
- On individual events (`created`, `fired`, `cancelled`, `paused`, `resumed`): updates the specific timer
- Uses `setInterval` at 1-second ticks to decrement `remainingMs` locally for smooth countdown display. Clamps at 0 — never goes negative. If local countdown reaches 0 before the `fired` event arrives, the UI shows "0:00" and waits for the server event.
- On SSE reconnect: the server sends a fresh `snapshot`, which resyncs all timers and corrects any drift from the local countdown
- On SSE error (service unreachable): silently hides the banner. No error indicator — the timer service being down is not an error the kitchen user needs to see.
- Returns: `{ timers: Timer[], firedTimers: Timer[], pause(id), resume(id), cancel(id), dismiss(id) }`
- `firedTimers` tracks recently fired timers until dismissed by the user. Multiple fired timers can accumulate — all are shown.

**Remaining time normalization:** The timer service uses `remainingMs` for running timers and `pausedRemainingMs` for paused timers. The hook normalizes this: when a timer is paused, it copies `pausedRemainingMs` into `remainingMs` so the UI can always read `remainingMs` regardless of status.

**`TimerBanner` component:**
- Rendered in `HomeBoard` above the hero strip
- Only visible when there are active timers or undismissed fired timers
- When hidden (no timers), takes no space — the hero strip is at the top as usual

**Timer card states:**
- **Running:** orange-tinted card, countdown ticking, ⏸ pause and ✕ cancel buttons
- **Paused:** shows frozen time with "PAUSED" label, ▶ resume and ✕ cancel buttons
- **Urgent (< 2 min remaining):** red-tinted card with pulse animation
- **Fired:** red banner with 🔔 bell, "[Name] timer is done!", Dismiss button

**Actions:** Pause, resume, cancel send `fetch()` requests directly to the timer service URL (not through the dashboard backend). Errors on these actions are silently ignored (the SSE stream will reflect the actual state). Dismiss is local-only (removes the fired alert from the UI).

### Timer state types

```typescript
interface Timer {
  id: string
  name: string
  durationMs: number
  startedAt: string
  endsAt: string
  status: 'running' | 'paused' | 'fired' | 'cancelled'
  remainingMs: number       // normalized: always present, even for paused timers
  pausedRemainingMs?: number // raw field from API (paused timers only)
  createdAt: string
}

interface TimerEvent {
  type: 'snapshot' | 'created' | 'fired' | 'cancelled' | 'paused' | 'resumed'
  timer?: Timer    // present for individual events
  timers?: Timer[] // present for snapshot
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

- Creating timers from the dashboard UI (timers are created via voice or other clients — `POST /timers/`)
- Sound/audio alert when timer fires (would need browser audio API)
- Timer history view

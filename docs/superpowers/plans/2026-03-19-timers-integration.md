# Timers Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live timer display as a floating banner above the hero strip, with real-time countdown updates via SSE from an external timer service.

**Architecture:** Pure frontend. A `useTimers` hook connects to the timer service via SSE (`EventSource`), maintains timer state, and ticks countdown locally every second. A `TimerBanner` component renders active and fired timers as cards in an orange/red banner above the hero strip. Actions (pause/resume/cancel) are sent directly to the timer service via fetch.

**Tech Stack:** React, TypeScript, SSE (EventSource), Zod

**Spec:** `docs/superpowers/specs/2026-03-19-timers-integration-design.md`

---

## File Structure

### New files (`frontend/src/integrations/timers/`)

| File | Responsibility |
|------|---------------|
| `config.ts` | `defineIntegration` with `hasBackend: false`, service_url config |
| `types.ts` | Timer and TimerEvent TypeScript types |
| `useTimers.ts` | SSE connection, state management, local countdown ticking, actions |
| `TimerBanner.tsx` | Floating banner component with timer cards |
| `TimerCard.tsx` | Individual timer card (running/paused/urgent states) |
| `index.ts` | Barrel export |

### Modified files

| File | Change |
|------|--------|
| `frontend/src/integrations/registry.ts` | Add `timersIntegration` |
| `frontend/src/boards/HomeBoard.tsx` | Add `TimerBanner` above hero strip |

---

### Task 1: Types and config

**Files:**
- Create: `frontend/src/integrations/timers/types.ts`
- Create: `frontend/src/integrations/timers/config.ts`
- Create: `frontend/src/integrations/timers/index.ts`
- Modify: `frontend/src/integrations/registry.ts`

- [ ] **Step 1: Create types**

Create `frontend/src/integrations/timers/types.ts`:

```typescript
export interface Timer {
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

export interface TimerEvent {
  type: 'snapshot' | 'created' | 'fired' | 'cancelled' | 'paused' | 'resumed'
  timer?: Timer
  timers?: Timer[]
}
```

- [ ] **Step 2: Create integration config**

Create `frontend/src/integrations/timers/config.ts`:

```typescript
import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const timersIntegration = defineIntegration({
  id: 'timers',
  name: 'Timers',
  hasBackend: false,
  schema: z.object({
    service_url: z.string().optional(),
  }),
  fields: {
    service_url: {
      label: 'Timer Service URL',
      description: 'e.g. http://192.168.1.21:3380',
    },
  },
})
```

- [ ] **Step 3: Create barrel export**

Create `frontend/src/integrations/timers/index.ts`:

```typescript
export { TimerBanner } from './TimerBanner'
export { timersIntegration } from './config'
```

Note: `TimerBanner` doesn't exist yet — create a placeholder:

Create `frontend/src/integrations/timers/TimerBanner.tsx`:
```typescript
export function TimerBanner() {
  return null
}
```

- [ ] **Step 4: Register in registry**

In `frontend/src/integrations/registry.ts`, add:
```typescript
import { timersIntegration } from './timers/config'
```
Add `timersIntegration` to the `integrations` array.

- [ ] **Step 5: Verify and commit**

Run: `cd frontend && npx tsc --noEmit`

```bash
git add frontend/src/integrations/timers/ frontend/src/integrations/registry.ts
git commit -m "feat(timers): add types, config, and integration registration"
```

---

### Task 2: useTimers hook

**Files:**
- Create: `frontend/src/integrations/timers/useTimers.ts`

- [ ] **Step 1: Create the SSE-based timer hook**

Create `frontend/src/integrations/timers/useTimers.ts`:

```typescript
import { useState, useEffect, useCallback, useRef } from 'react'
import type { Timer, TimerEvent } from './types'

/** Normalize a timer from the API: ensure remainingMs is always set */
function normalizeTimer(t: Timer): Timer {
  if (t.status === 'paused' && t.pausedRemainingMs != null) {
    return { ...t, remainingMs: t.pausedRemainingMs }
  }
  return t
}

export function useTimers(serviceUrl: string | undefined) {
  const [timers, setTimers] = useState<Timer[]>([])
  const [firedTimers, setFiredTimers] = useState<Timer[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)

  // SSE connection
  useEffect(() => {
    if (!serviceUrl) return

    const url = `${serviceUrl.replace(/\/$/, '')}/timers/events`
    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data: TimerEvent = JSON.parse(event.data)

        switch (data.type) {
          case 'snapshot':
            if (data.timers) {
              setTimers(data.timers.filter((t) => t.status === 'running' || t.status === 'paused').map(normalizeTimer))
            }
            break
          case 'created':
            if (data.timer) {
              const t = normalizeTimer(data.timer)
              setTimers((prev) => [...prev.filter((p) => p.id !== t.id), t])
            }
            break
          case 'fired':
            if (data.timer) {
              setTimers((prev) => prev.filter((p) => p.id !== data.timer!.id))
              setFiredTimers((prev) => [...prev, normalizeTimer(data.timer!)])
            }
            break
          case 'cancelled':
            if (data.timer) {
              setTimers((prev) => prev.filter((p) => p.id !== data.timer!.id))
            }
            break
          case 'paused':
            if (data.timer) {
              const t = normalizeTimer(data.timer)
              setTimers((prev) => prev.map((p) => (p.id === t.id ? t : p)))
            }
            break
          case 'resumed':
            if (data.timer) {
              const t = normalizeTimer(data.timer)
              setTimers((prev) => prev.map((p) => (p.id === t.id ? t : p)))
            }
            break
        }
      } catch {
        // Ignore parse errors
      }
    }

    es.onerror = () => {
      // EventSource auto-reconnects. On reconnect, the server sends a
      // fresh snapshot which resyncs everything.
    }

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [serviceUrl])

  // Local countdown tick — decrement remainingMs every second for running timers
  useEffect(() => {
    if (timers.length === 0) return

    const interval = setInterval(() => {
      setTimers((prev) =>
        prev.map((t) => {
          if (t.status !== 'running') return t
          const remaining = Math.max(0, t.remainingMs - 1000)
          return { ...t, remainingMs: remaining }
        }),
      )
    }, 1000)

    return () => clearInterval(interval)
  }, [timers.length])

  // Actions
  const baseUrl = serviceUrl?.replace(/\/$/, '')

  const pause = useCallback(
    async (id: string) => {
      if (!baseUrl) return
      await fetch(`${baseUrl}/timers/${id}/pause`, { method: 'POST' }).catch(() => {})
    },
    [baseUrl],
  )

  const resume = useCallback(
    async (id: string) => {
      if (!baseUrl) return
      await fetch(`${baseUrl}/timers/${id}/resume`, { method: 'POST' }).catch(() => {})
    },
    [baseUrl],
  )

  const cancel = useCallback(
    async (id: string) => {
      if (!baseUrl) return
      await fetch(`${baseUrl}/timers/${id}`, { method: 'DELETE' }).catch(() => {})
    },
    [baseUrl],
  )

  const dismiss = useCallback((id: string) => {
    setFiredTimers((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { timers, firedTimers, pause, resume, cancel, dismiss }
}
```

- [ ] **Step 2: Verify and commit**

Run: `cd frontend && npx tsc --noEmit`

```bash
git add frontend/src/integrations/timers/useTimers.ts
git commit -m "feat(timers): add useTimers hook with SSE connection and local countdown"
```

---

### Task 3: TimerCard component

**Files:**
- Create: `frontend/src/integrations/timers/TimerCard.tsx`

- [ ] **Step 1: Create the timer card component**

Create `frontend/src/integrations/timers/TimerCard.tsx`:

```typescript
import type { Timer } from './types'

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}:${String(mins).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

interface TimerCardProps {
  timer: Timer
  onPause: () => void
  onResume: () => void
  onCancel: () => void
}

export function TimerCard({ timer, onPause, onResume, onCancel }: TimerCardProps) {
  const isUrgent = timer.status === 'running' && timer.remainingMs < 2 * 60 * 1000
  const isPaused = timer.status === 'paused'

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
        isUrgent
          ? 'bg-[rgba(229,57,53,0.3)] animate-pulse'
          : 'bg-[rgba(255,255,255,0.12)]'
      }`}
    >
      <span className="text-[18px]">⏲️</span>
      <div>
        <div
          className={`text-[22px] font-bold tabular-nums leading-none ${
            isUrgent ? 'text-[#ffcdd2]' : 'text-white'
          }`}
        >
          {formatCountdown(timer.remainingMs)}
        </div>
        <div className="text-[10px] text-white/75">
          {timer.name}
          {isPaused && <span className="ml-1 text-white/50">PAUSED</span>}
        </div>
      </div>
      <div className="flex gap-1 ml-2">
        {isPaused ? (
          <button
            onClick={onResume}
            className="w-7 h-7 rounded-md bg-white/20 hover:bg-white/30 text-white text-[12px] flex items-center justify-center"
            title="Resume"
          >
            ▶
          </button>
        ) : (
          <button
            onClick={onPause}
            className="w-7 h-7 rounded-md bg-white/20 hover:bg-white/30 text-white text-[12px] flex items-center justify-center"
            title="Pause"
          >
            ⏸
          </button>
        )}
        <button
          onClick={onCancel}
          className="w-7 h-7 rounded-md bg-white/20 hover:bg-white/30 text-white text-[12px] flex items-center justify-center"
          title="Cancel"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify and commit**

Run: `cd frontend && npx tsc --noEmit`

```bash
git add frontend/src/integrations/timers/TimerCard.tsx
git commit -m "feat(timers): add TimerCard component with countdown and controls"
```

---

### Task 4: TimerBanner component

**Files:**
- Modify: `frontend/src/integrations/timers/TimerBanner.tsx`

- [ ] **Step 1: Implement the full TimerBanner**

Replace `frontend/src/integrations/timers/TimerBanner.tsx`:

```typescript
import { useState, useEffect, useCallback } from 'react'
import { useTimers } from './useTimers'
import { TimerCard } from './TimerCard'

export function TimerBanner() {
  const [serviceUrl, setServiceUrl] = useState<string | undefined>(undefined)

  // Load service URL from config
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((config: Record<string, string>) => {
        const url = config['timers.service_url']
        if (url) setServiceUrl(url)
      })
      .catch(() => {})
  }, [])

  const { timers, firedTimers, pause, resume, cancel, dismiss } = useTimers(serviceUrl)

  const hasContent = timers.length > 0 || firedTimers.length > 0
  if (!hasContent) return null

  return (
    <div className="space-y-2">
      {/* Fired timer alerts */}
      {firedTimers.map((timer) => (
        <div
          key={timer.id}
          className="flex items-center gap-3 px-5 py-3 rounded-[var(--radius-card)] shadow-[var(--shadow-card)]"
          style={{ background: 'linear-gradient(135deg, #e53935 0%, #ef5350 100%)' }}
        >
          <span className="text-[22px]">🔔</span>
          <div className="flex-1">
            <div className="text-[14px] font-bold text-white">{timer.name} timer is done!</div>
            <div className="text-[10px] text-white/70">
              {Math.round(timer.durationMs / 60000)} minutes · completed
            </div>
          </div>
          <button
            onClick={() => dismiss(timer.id)}
            className="px-4 py-1.5 rounded-md bg-white/20 hover:bg-white/30 text-white text-[11px] font-semibold"
          >
            Dismiss
          </button>
        </div>
      ))}

      {/* Active timers banner */}
      {timers.length > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-2 rounded-[var(--radius-card)] shadow-[var(--shadow-card)]"
          style={{ background: 'linear-gradient(135deg, var(--color-palette-1) 0%, #d4784a 100%)' }}
        >
          {timers.map((timer, i) => (
            <div key={timer.id} className="flex items-center gap-3">
              {i > 0 && <div className="w-px h-8 bg-white/15" />}
              <TimerCard
                timer={timer}
                onPause={() => pause(timer.id)}
                onResume={() => resume(timer.id)}
                onCancel={() => cancel(timer.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify and commit**

Run: `cd frontend && npx tsc --noEmit`

```bash
git add frontend/src/integrations/timers/TimerBanner.tsx
git commit -m "feat(timers): add TimerBanner with fired alerts and active timer cards"
```

---

### Task 5: Wire into HomeBoard

**Files:**
- Modify: `frontend/src/boards/HomeBoard.tsx`

- [ ] **Step 1: Add TimerBanner above hero strip**

Read `frontend/src/boards/HomeBoard.tsx`, then:

1. Add import:
```typescript
import { TimerBanner } from '@/integrations/timers'
```

2. Add the TimerBanner above the hero strip. Find the hero strip section:
```typescript
      {/* Hero strip -- full width */}
      <div style={{ gridColumn: '1 / -1' }}>
        <HeroStripWithData heroEvents={heroEvents} />
      </div>
```

Add the timer banner before it:
```typescript
      {/* Timer banner -- full width, only shows when timers active */}
      <div style={{ gridColumn: '1 / -1' }}>
        <TimerBanner />
      </div>

      {/* Hero strip -- full width */}
      <div style={{ gridColumn: '1 / -1' }}>
        <HeroStripWithData heroEvents={heroEvents} />
      </div>
```

3. Update the grid template rows to add an `auto` row for the timer banner:
```typescript
      style={{
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gridTemplateRows: 'auto auto 1fr 1fr',
      }}
```

4. Update grid row references for the widgets below. Calendar currently uses `gridRow: '2 / 4'` — this needs to become `gridRow: '3 / 5'` since we added a row. Similarly, chores `gridRow` if any.

Check each widget's `gridRow` and increment by 1.

- [ ] **Step 2: Verify and commit**

Run: `cd frontend && npx tsc --noEmit`

```bash
git add frontend/src/boards/HomeBoard.tsx
git commit -m "feat(timers): wire TimerBanner into HomeBoard above hero strip"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1: Type check**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 2: Visual verification**

Start the frontend dev server and verify:
- Settings → Timers shows the service URL field
- With no URL configured, the home board looks normal (no timer banner)
- Configure the timer service URL in settings
- When no timers are active, the banner is hidden
- When a timer is created (via the timer service), the orange banner appears above the hero strip
- Countdown ticks every second
- Pause button freezes the countdown and shows "PAUSED"
- Resume button restarts the countdown
- Cancel button removes the timer
- When a timer fires, a red alert banner appears with "X timer is done!" and a Dismiss button
- Dismissing removes the fired alert
- When the last timer is gone, the banner disappears

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "feat(timers): complete timers integration"
```

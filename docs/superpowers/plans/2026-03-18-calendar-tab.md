# Calendar Tab Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-page monthly calendar view as a new tab, showing events in grid cells with a tap-to-open day detail modal.

**Architecture:** Pure frontend feature. A new `CalendarBoard` route renders a `MonthGrid` of `DayCell` components showing event pills. A `useMonthCalendar` hook fetches a month's worth of events from the existing Google Calendar backend. Tapping a day opens a `DayDetailModal` with the full event list.

**Tech Stack:** React, TypeScript, TanStack Query (via usePolling), lucide-react icons

**Spec:** `docs/superpowers/specs/2026-03-18-calendar-tab-design.md`

---

## File Structure

### New files (`frontend/src/boards/calendar/`)

| File | Responsibility |
|------|---------------|
| `CalendarBoard.tsx` | Full-page board: month state management, data fetching, layout |
| `MonthGrid.tsx` | Calendar grid: header with nav, weekday labels, 7-column day grid |
| `DayCell.tsx` | Single day cell: day number, event pills (max 2), "+N more" |
| `DayDetailModal.tsx` | Modal with full event list for a selected day |
| `useMonthCalendar.ts` | Data hook: fetches month of events, groups by date |
| `formatEventTime.ts` | Shared utility for formatting event times |

### Modified files

| File | Change |
|------|--------|
| `frontend/src/App.tsx` | Add `/calendar` route → `CalendarBoard` |
| `frontend/src/ui/TabBar.tsx` | Add Calendar tab between Home and Media, adjust gap |

---

## Chunk 1: Data hook + routing + board skeleton

### Task 1: useMonthCalendar data hook

**Files:**
- Create: `frontend/src/boards/calendar/useMonthCalendar.ts`

- [ ] **Step 1: Create the data hook**

Create `frontend/src/boards/calendar/useMonthCalendar.ts`:

```typescript
import { usePolling } from '@/hooks/usePolling'
import { googleCalendarIntegration } from '@/integrations/google-calendar/config'
import type { CalendarEvent } from '@/integrations/google-calendar/types'

export interface MonthEvents {
  /** Map of "YYYY-MM-DD" → sorted events for that day */
  byDate: Record<string, CalendarEvent[]>
}

/**
 * Fetch a full month of calendar events, including padding days
 * for partial first/last weeks.
 */
async function fetchMonthEvents(year: number, month: number): Promise<MonthEvents> {
  // Read calendar IDs from config
  let calendarIds: string[] = []
  try {
    const allConfig: Record<string, string> = await fetch('/api/config').then(
      (r) => r.json(),
    )
    const saved = allConfig['google-calendar.calendar_ids']
    if (saved) {
      calendarIds = JSON.parse(saved)
    }
  } catch {
    // Config not available
  }
  if (calendarIds.length === 0) {
    calendarIds = ['primary']
  }

  // Calculate date range: first Sunday of the grid to last Saturday
  const firstOfMonth = new Date(year, month, 1)
  const gridStart = new Date(firstOfMonth)
  gridStart.setDate(gridStart.getDate() - gridStart.getDay()) // back to Sunday

  const lastOfMonth = new Date(year, month + 1, 0)
  const gridEnd = new Date(lastOfMonth)
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()) + 1) // forward to next Sunday (exclusive end)

  const startStr = gridStart.toISOString()
  const endStr = gridEnd.toISOString()

  const results = await Promise.all(
    calendarIds.map((id) =>
      googleCalendarIntegration.api
        .get<CalendarEvent[]>(
          `/events?calendar=${encodeURIComponent(id)}&start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`,
        )
        .catch(() => []),
    ),
  )

  const allEvents = results.flat()
  const byDate: Record<string, CalendarEvent[]> = {}

  for (const event of allEvents) {
    const startDate = event.start.dateTime ?? event.start.date ?? ''
    const dateKey = startDate.substring(0, 10)
    if (!dateKey) continue

    // For multi-day events, add to each day they span
    const endDate = event.end.dateTime ?? event.end.date ?? startDate
    const endKey = endDate.substring(0, 10)

    if (dateKey === endKey) {
      // Single-day event: just add to start date
      if (!byDate[dateKey]) byDate[dateKey] = []
      byDate[dateKey].push(event)
    } else {
      // Multi-day event (all-day or timed): add to each day
      const cursor = new Date(dateKey + 'T12:00:00')
      const end = new Date(endKey + 'T12:00:00')
      while (cursor < end) {
        const key = cursor.toISOString().substring(0, 10)
        if (!byDate[key]) byDate[key] = []
        byDate[key].push(event)
        cursor.setDate(cursor.getDate() + 1)
      }
    }
  }

  // Sort events within each day: all-day first, then by start time
  for (const events of Object.values(byDate)) {
    events.sort((a, b) => {
      const aAllDay = !a.start.dateTime
      const bAllDay = !b.start.dateTime
      if (aAllDay && !bAllDay) return -1
      if (!aAllDay && bAllDay) return 1
      const aTime = a.start.dateTime ?? a.start.date ?? ''
      const bTime = b.start.dateTime ?? b.start.date ?? ''
      return aTime.localeCompare(bTime)
    })
  }

  return { byDate }
}

export function useMonthCalendar(year: number, month: number) {
  return usePolling<MonthEvents>({
    queryKey: ['google-calendar', 'month', String(year), String(month)],
    fetcher: () => fetchMonthEvents(year, month),
    intervalMs: 5 * 60 * 1000,
  })
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/boards/calendar/useMonthCalendar.ts
git commit -m "feat(calendar-tab): add useMonthCalendar data hook"
```

---

### Task 2: CalendarBoard skeleton + routing + tab

**Files:**
- Create: `frontend/src/boards/calendar/CalendarBoard.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/ui/TabBar.tsx`

- [ ] **Step 1: Create the CalendarBoard skeleton**

Create `frontend/src/boards/calendar/CalendarBoard.tsx`:

```typescript
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMonthCalendar } from './useMonthCalendar'

export function CalendarBoard() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const { data, isLoading, error } = useMonthCalendar(year, month)

  const goToPrev = () => {
    if (month === 0) {
      setYear(year - 1)
      setMonth(11)
    } else {
      setMonth(month - 1)
    }
  }

  const goToNext = () => {
    if (month === 11) {
      setYear(year + 1)
      setMonth(0)
    } else {
      setMonth(month + 1)
    }
  }

  const goToToday = () => {
    const today = new Date()
    setYear(today.getFullYear())
    setMonth(today.getMonth())
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()
  const monthName = new Date(year, month).toLocaleDateString([], { month: 'long', year: 'numeric' })

  return (
    <div className="h-full flex flex-col p-4 gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold text-text-primary">{monthName}</h1>
        <div className="flex items-center gap-2">
          {!isCurrentMonth && (
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-[12px] font-medium text-calendar bg-calendar/10 rounded-[var(--radius-button)] hover:bg-calendar/20 transition-colors"
            >
              Today
            </button>
          )}
          <button
            onClick={goToPrev}
            className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-button)] border border-border text-text-muted hover:bg-bg-card-hover transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={goToNext}
            className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-button)] border border-border text-text-muted hover:bg-bg-card-hover transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Calendar grid area */}
      <div className="flex-1 min-h-0 bg-bg-card rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden flex flex-col">
        {error ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-text-muted">
            Connect Google Calendar in Settings
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[13px] text-text-muted">
            {isLoading ? 'Loading...' : `Month grid placeholder — ${Object.keys(data?.byDate ?? {}).length} days with events`}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add route in App.tsx**

In `frontend/src/App.tsx`, add the import:
```typescript
import { CalendarBoard } from './boards/calendar/CalendarBoard'
```

Add the route inside the `<Route element={<AppShell />}>` block, after the index route:
```typescript
<Route path="calendar" element={<CalendarBoard />} />
```

- [ ] **Step 3: Add Calendar tab to TabBar**

In `frontend/src/ui/TabBar.tsx`:

Update the import to include `CalendarDays`:
```typescript
import { Home, CalendarDays, Music, Camera, type LucideIcon } from 'lucide-react'
```

Add the Calendar tab entry after Home in the `tabs` array:
```typescript
{ to: '/calendar', label: 'Calendar', icon: CalendarDays },
```

Update the gap from `gap-[60px]` to `gap-[40px]` to fit 4 tabs:
```typescript
className="flex items-center justify-center gap-[40px] bg-bg-card border-t border-border"
```

- [ ] **Step 4: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/boards/calendar/CalendarBoard.tsx frontend/src/App.tsx frontend/src/ui/TabBar.tsx
git commit -m "feat(calendar-tab): add CalendarBoard route and tab navigation"
```

---

## Chunk 2: Grid components + modal

### Task 3: Shared formatEventTime utility + DayCell component

**Files:**
- Create: `frontend/src/boards/calendar/formatEventTime.ts`
- Create: `frontend/src/boards/calendar/DayCell.tsx`

- [ ] **Step 1: Create shared time formatting utility**

Create `frontend/src/boards/calendar/formatEventTime.ts`:

```typescript
import type { CalendarEvent } from '@/integrations/google-calendar/types'

/** Compact time for day cell pills (e.g. "5p", "10:30a") */
export function formatEventTimeCompact(event: CalendarEvent): string | null {
  if (!event.start.dateTime) return null // all-day
  const d = new Date(event.start.dateTime)
  const h = d.getHours()
  const m = d.getMinutes()
  const suffix = h >= 12 ? 'p' : 'a'
  const hour = h % 12 || 12
  return m === 0 ? `${hour}${suffix}` : `${hour}:${m.toString().padStart(2, '0')}${suffix}`
}

/** Full time range for day detail modal (e.g. "5:00 PM – 6:30 PM" or "All day") */
export function formatEventTimeFull(event: CalendarEvent): string {
  if (!event.start.dateTime) return 'All day'
  const start = new Date(event.start.dateTime)
  let time = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (event.end.dateTime) {
    const end = new Date(event.end.dateTime)
    time += ' – ' + end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  return time
}
```

- [ ] **Step 2: Create the DayCell component**

Create `frontend/src/boards/calendar/DayCell.tsx`:

```typescript
import type { CalendarEvent } from '@/integrations/google-calendar/types'
import { formatEventTimeCompact } from './formatEventTime'

const MAX_PILLS = 2

interface DayCellProps {
  date: Date
  events: CalendarEvent[]
  isToday: boolean
  isCurrentMonth: boolean
  isSelected: boolean
  onClick: () => void
}

export function DayCell({ date, events, isToday, isCurrentMonth, isSelected, onClick }: DayCellProps) {
  const dayNum = date.getDate()
  const visible = events.slice(0, MAX_PILLS)
  const remaining = events.length - visible.length

  return (
    <div
      className={`flex flex-col p-1 border-b border-r border-border overflow-hidden cursor-pointer transition-colors ${
        isSelected ? 'bg-calendar/5' : 'hover:bg-bg-card-hover'
      } ${!isCurrentMonth ? 'opacity-40' : ''}`}
      onClick={onClick}
    >
      <div className="flex-shrink-0 mb-0.5">
        <span
          className={`inline-flex items-center justify-center text-[12px] font-medium ${
            isToday
              ? 'w-6 h-6 rounded-full bg-calendar text-white'
              : 'text-text-primary'
          }`}
        >
          {dayNum}
        </span>
      </div>

      {isCurrentMonth && (
        <div className="flex-1 min-h-0 flex flex-col gap-[2px] overflow-hidden">
          {visible.map((event, i) => {
            const time = formatEventTimeCompact(event)
            return (
              <div
                key={event.id + '-' + i}
                className="text-[9px] leading-tight truncate rounded px-1 py-[1px]"
                style={{
                  background: 'color-mix(in srgb, var(--color-calendar) 15%, transparent)',
                  color: 'var(--color-calendar)',
                }}
              >
                {time && <span className="font-medium">{time} </span>}
                {event.summary ?? '(No title)'}
              </div>
            )
          })}
          {remaining > 0 && (
            <div className="text-[8px] text-text-muted pl-1">+{remaining} more</div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/boards/calendar/formatEventTime.ts frontend/src/boards/calendar/DayCell.tsx
git commit -m "feat(calendar-tab): add shared time formatting and DayCell component"
```

---

### Task 4: DayDetailModal component

**Files:**
- Create: `frontend/src/boards/calendar/DayDetailModal.tsx`

- [ ] **Step 1: Create the day detail modal**

Create `frontend/src/boards/calendar/DayDetailModal.tsx`:

```typescript
import { Modal } from '@/ui/Modal'
import type { CalendarEvent } from '@/integrations/google-calendar/types'
import { formatEventTimeFull } from './formatEventTime'

interface DayDetailModalProps {
  date: Date | null
  events: CalendarEvent[]
  onClose: () => void
}

export function DayDetailModal({ date, events, onClose }: DayDetailModalProps) {
  const title = date?.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <Modal isOpen={!!date} onClose={onClose} title={title ?? ''}>
      {events.length === 0 ? (
        <div className="text-[13px] text-text-muted py-2">No events</div>
      ) : (
        <div className="space-y-0">
          {events.map((event, i) => (
            <div
              key={event.id + '-' + i}
              className="flex gap-3 py-2.5 border-b border-border last:border-b-0"
            >
              <div
                className="w-1 rounded-full flex-shrink-0 mt-1"
                style={{ background: 'var(--color-calendar)', minHeight: '14px' }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-text-muted">
                  {formatEventTimeFull(event)}
                </div>
                <div className="text-[14px] font-medium text-text-primary">
                  {event.summary ?? '(No title)'}
                </div>
                {event.location && (
                  <div className="text-[11px] text-text-muted mt-0.5 truncate">
                    {event.location}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/boards/calendar/DayDetailModal.tsx
git commit -m "feat(calendar-tab): add DayDetailModal for day event list"
```

---

### Task 5: MonthGrid component

**Files:**
- Create: `frontend/src/boards/calendar/MonthGrid.tsx`

- [ ] **Step 1: Create the MonthGrid component**

Create `frontend/src/boards/calendar/MonthGrid.tsx`:

```typescript
import type { CalendarEvent } from '@/integrations/google-calendar/types'
import { DayCell } from './DayCell'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface MonthGridProps {
  year: number
  month: number
  eventsByDate: Record<string, CalendarEvent[]>
  selectedDate: string | null
  onDayClick: (date: Date, dateKey: string) => void
}

function getGridDates(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1)
  const lastOfMonth = new Date(year, month + 1, 0)

  // Start from Sunday of the first week
  const start = new Date(firstOfMonth)
  start.setDate(start.getDate() - start.getDay())

  // End on Saturday of the last week
  const end = new Date(lastOfMonth)
  end.setDate(end.getDate() + (6 - end.getDay()))

  const dates: Date[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    dates.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function MonthGrid({ year, month, eventsByDate, selectedDate, onDayClick }: MonthGridProps) {
  const dates = getGridDates(year, month)
  const todayKey = dateKey(new Date())

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border flex-shrink-0">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-[10px] font-semibold text-text-muted uppercase py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        className="grid grid-cols-7 flex-1 min-h-0"
        style={{ gridTemplateRows: `repeat(${dates.length / 7}, 1fr)` }}
      >
        {dates.map((date) => {
          const key = dateKey(date)
          return (
            <DayCell
              key={key}
              date={date}
              events={eventsByDate[key] ?? []}
              isToday={key === todayKey}
              isCurrentMonth={date.getMonth() === month}
              isSelected={key === selectedDate}
              onClick={() => onDayClick(date, key)}
            />
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/boards/calendar/MonthGrid.tsx
git commit -m "feat(calendar-tab): add MonthGrid component with day cells"
```

---

### Task 6: Wire MonthGrid and DayDetailModal into CalendarBoard

**Files:**
- Modify: `frontend/src/boards/calendar/CalendarBoard.tsx`

- [ ] **Step 1: Replace the CalendarBoard placeholder with the full implementation**

Replace `frontend/src/boards/calendar/CalendarBoard.tsx`:

```typescript
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMonthCalendar } from './useMonthCalendar'
import { MonthGrid } from './MonthGrid'
import { DayDetailModal } from './DayDetailModal'

export function CalendarBoard() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDate, setSelectedDate] = useState<{ date: Date; key: string } | null>(null)

  const { data, error } = useMonthCalendar(year, month)

  const goToPrev = () => {
    if (month === 0) {
      setYear(year - 1)
      setMonth(11)
    } else {
      setMonth(month - 1)
    }
  }

  const goToNext = () => {
    if (month === 11) {
      setYear(year + 1)
      setMonth(0)
    } else {
      setMonth(month + 1)
    }
  }

  const goToToday = () => {
    const today = new Date()
    setYear(today.getFullYear())
    setMonth(today.getMonth())
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()
  const monthName = new Date(year, month).toLocaleDateString([], { month: 'long', year: 'numeric' })

  const handleDayClick = (date: Date, dateKey: string) => {
    setSelectedDate({ date, key: dateKey })
  }

  const eventsByDate = data?.byDate ?? {}

  return (
    <div className="h-full flex flex-col p-4 gap-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <h1 className="text-[22px] font-semibold text-text-primary">{monthName}</h1>
        <div className="flex items-center gap-2">
          {!isCurrentMonth && (
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-[12px] font-medium text-calendar bg-calendar/10 rounded-[var(--radius-button)] hover:bg-calendar/20 transition-colors"
            >
              Today
            </button>
          )}
          <button
            onClick={goToPrev}
            className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-button)] border border-border text-text-muted hover:bg-bg-card-hover transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={goToNext}
            className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-button)] border border-border text-text-muted hover:bg-bg-card-hover transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 min-h-0 bg-bg-card rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden flex flex-col">
        {error ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-text-muted">
            Connect Google Calendar in Settings
          </div>
        ) : (
          <MonthGrid
            year={year}
            month={month}
            eventsByDate={eventsByDate}
            selectedDate={selectedDate?.key ?? null}
            onDayClick={handleDayClick}
          />
        )}
      </div>

      {/* Day detail modal */}
      <DayDetailModal
        date={selectedDate?.date ?? null}
        events={selectedDate ? (eventsByDate[selectedDate.key] ?? []) : []}
        onClose={() => setSelectedDate(null)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/boards/calendar/CalendarBoard.tsx
git commit -m "feat(calendar-tab): wire MonthGrid and DayDetailModal into CalendarBoard"
```

---

### Task 7: End-to-end verification

- [ ] **Step 1: Type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 2: Visual verification**

Start the frontend dev server and verify:
- New "Calendar" tab appears in the tab bar between Home and Media
- Tapping Calendar tab shows the monthly grid with current month
- Days with events show colored pills with event names
- Today is highlighted with an orange circle
- Left/right arrows navigate between months
- "Today" button appears when viewing a different month
- Tapping a day opens a modal with the full event list
- Adjacent month days are dimmed
- Grid fills available height

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "feat(calendar-tab): complete monthly calendar view"
```

import { useMemo, useState } from 'react'
import type { PollResult } from '@/integrations/types'
import { useIntegrationConfig } from '@/platform'
import { activeScenario } from '@/lib/scenario'
import { useCalendarWindow, type CalendarEvent } from '@/providers/google-calendar'
import { calendarIntegration } from './config'
import { weekFixtureFor } from './fixtures'
import { eventLocalDateStr, parseLocalDate, toLocalDateStr } from '@/utils/date'

export interface CalendarDay {
  date: Date
  label: string
  isToday: boolean
  events: CalendarEvent[]
}

export type CalendarData = PollResult<CalendarDay[]>

function dayLabel(date: Date, today: Date): string {
  const diff = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const short = date.toLocaleDateString([], { month: 'numeric', day: 'numeric' })
  if (diff === 0) return `Today ${short}`
  if (diff === 1) return `Tomorrow ${short}`
  return `${date.toLocaleDateString([], { weekday: 'long' })} ${short}`
}

/**
 * Today and the next six days, each holding the events that start on it.
 *
 * Takes the whole window and keeps what lands: an event outside the seven
 * days simply matches no bucket. That is the same result the seven-day fetch
 * produced — it also returned events this dropped, because Google returns
 * everything *overlapping* a range and a multi-day event running into today
 * buckets under the day it started.
 */
function bucketWeekDays(events: CalendarEvent[], today: Date): CalendarDay[] {
  const dayMap = new Map<string, CalendarEvent[]>()

  for (let i = 0; i < 7; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    dayMap.set(toLocalDateStr(d), [])
  }

  for (const event of events) {
    const bucket = dayMap.get(eventLocalDateStr(event))
    if (bucket) {
      bucket.push(event)
    }
  }

  const days: CalendarDay[] = []
  const todayStr = toLocalDateStr(today)

  for (const [dateStr, dayEvents] of dayMap) {
    const date = parseLocalDate(dateStr)
    dayEvents.sort((a, b) => {
      const aTime = a.start.dateTime ?? a.start.date ?? ''
      const bTime = b.start.dateTime ?? b.start.date ?? ''
      return new Date(aTime).getTime() - new Date(bTime).getTime()
    })
    days.push({
      date,
      label: dayLabel(date, today),
      isToday: dateStr === todayStr,
      events: dayEvents,
    })
  }

  return days
}

/** A cheap content key for a week: what it shows, not which arrays hold it. */
function weekSignature(days: CalendarDay[]): string {
  return days.map((d) => `${d.label}:${d.events.map((e) => e.id).join(',')}`).join('|')
}

/**
 * Today plus the next six days, each with its events, for the week strip.
 *
 * A pure filter over the provider's synced window — it issues no request of
 * its own. Today through today+7 is inside that window on every day of every
 * month (the window runs from the 1st of last month to the 1st of the month
 * six ahead), so unlike the ranged consumers this needs no containment check
 * and cannot fall outside.
 *
 * The calendar ids come from `useIntegrationConfig` and are handed to the
 * window, which keeps this reactive to config: editing the selected calendars
 * in admin re-syncs the new ones with no remount. The tablet is a
 * wall-mounted kiosk that never reloads, so "picked up on the next reload"
 * means "never".
 *
 * A scenario fixture disables the sync rather than merely ignoring it: the
 * point of a fixture is a dashboard that renders with no upstream at all.
 *
 * **Not blanking during a calendar swap is this hook's job.** The window
 * deliberately has no `keepPreviousData` — its observers are positional over
 * a runtime-length list, so carrying data across an id change could file one
 * calendar's events under another's — so it hands back nothing while the new
 * ids sync, and the last completed week is held here instead. Before this
 * moved into the query key at all, the ids were re-read *inside* the
 * fetcher and the previous week stayed up throughout; keep that.
 *
 * The result is adapted to `PollResult` — `data` is `null`, not react-query's
 * `undefined`, until events have actually arrived. See `useLunchMenu` for why
 * that distinction matters to callers. `isLoading` covers the config wait
 * too, because `ScheduleColumn` chooses between "Fetching the week ahead…"
 * and "Nothing on the books this week." on it alone.
 */
export function useGoogleCalendar(): CalendarData {
  const config = useIntegrationConfig(calendarIntegration)
  const fixture = weekFixtureFor(activeScenario)
  const synced = useCalendarWindow(config?.calendar_ids, { enabled: !fixture })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayMs = today.getTime()

  const days = useMemo(
    () => fixture ?? bucketWeekDays(synced.events, new Date(todayMs)),
    [fixture, synced.events, todayMs],
  )

  // The last week we could actually build, so a config change that re-syncs
  // the window shows the previous one rather than seven empty days. Kept
  // against its signature rather than its identity: the window hands back a
  // fresh array every render, and storing on identity alone would be a
  // render loop.
  const [kept, setKept] = useState<{ signature: string; days: CalendarDay[] } | null>(null)
  const signature = synced.isLoading ? null : weekSignature(days)

  // React's documented way to adjust state from what rendered, rather than an
  // effect: it settles before the browser sees anything, so the strip never
  // paints a blank frame between the two weeks.
  if (signature !== null && signature !== kept?.signature) {
    setKept({ signature, days })
  }

  const data = synced.isLoading ? (kept?.days ?? null) : days

  return {
    data,
    error: synced.error ? synced.error.message : null,
    isLoading: data === null && synced.isLoading,
    refetch: synced.refetch,
  }
}

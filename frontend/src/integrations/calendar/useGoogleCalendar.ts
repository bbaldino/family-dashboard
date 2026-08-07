import { useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { PollResult } from '@/integrations/types'
import { useAllConfig, useIntegrationConfig } from '@/platform'
import { activeScenario } from '@/lib/scenario'
import {
  fetchEventsForCalendars,
  readCalendarIdsOrDefault,
  type CalendarEvent,
} from '@/providers/google-calendar'
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

/** Named for what it returns rather than what it fetches, so it does not read
 *  as an overload of the provider's `fetchCalendarEvents` — that one is one
 *  calendar's raw events, this is the whole week bucketed into days. */
async function fetchWeekDays(calendarIds: string[]): Promise<CalendarDay[]> {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfWeek = new Date(today)
  endOfWeek.setDate(endOfWeek.getDate() + 7)

  const startStr = today.toISOString()
  const endStr = endOfWeek.toISOString()

  const allEvents = await fetchEventsForCalendars(calendarIds, startStr, endStr)

  // Group by date
  const dayMap = new Map<string, CalendarEvent[]>()

  for (let i = 0; i < 7; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    dayMap.set(toLocalDateStr(d), [])
  }

  for (const event of allEvents) {
    const bucket = dayMap.get(eventLocalDateStr(event))
    if (bucket) {
      bucket.push(event)
    }
  }

  const days: CalendarDay[] = []
  const todayStr = toLocalDateStr(today)

  for (const [dateStr, events] of dayMap) {
    const date = parseLocalDate(dateStr)
    events.sort((a, b) => {
      const aTime = a.start.dateTime ?? a.start.date ?? ''
      const bTime = b.start.dateTime ?? b.start.date ?? ''
      return new Date(aTime).getTime() - new Date(bTime).getTime()
    })
    days.push({
      date,
      label: dayLabel(date, today),
      isToday: dateStr === todayStr,
      events,
    })
  }

  return days
}

/**
 * Today plus the next six days, each with its events, for the week strip.
 *
 * The calendar ids come from `useIntegrationConfig` and sit *in the query
 * key*, which is what keeps this reactive to config: editing the selected
 * calendars in admin re-asks the new ones with no remount. That used to be a
 * side effect of a raw `/api/config` read living inside the poll's fetcher —
 * invisible, and the only thing making a config change visible on a kiosk
 * that never reloads.
 *
 * The fan-out it calls is the provider's *catching* one: several calendars
 * mean several ways to lose one, and a revoked share must not blank the rest
 * of the week. A single-calendar consumer wants the opposite, and takes
 * `fetchCalendarEvents` instead.
 *
 * `useAllConfig`'s pending flag gates the query for the reason
 * `useCalendarEvents` documents: config reads as `null` both while it loads
 * and when it is absent, so an ungated first render would fetch `primary`
 * and then correct itself — the strip filling, blanking, and filling again.
 * That same flag also feeds `isLoading`, because `ScheduleColumn` chooses
 * between "Fetching the week ahead…" and "Nothing on the books this week."
 * on it alone.
 *
 * The result is adapted back to `PollResult` — `data` is `null`, not
 * react-query's `undefined`, until a fetch has actually succeeded. See
 * `useLunchMenu` for why that distinction matters to callers.
 */
export function useGoogleCalendar(): CalendarData {
  const { isPending: configPending } = useAllConfig()
  const config = useIntegrationConfig(calendarIntegration)
  const savedIds = config?.calendar_ids
  const calendarIds = useMemo(() => readCalendarIdsOrDefault(savedIds), [savedIds])

  const query = useQuery({
    queryKey: ['calendar', 'week', calendarIds],
    queryFn: () => {
      const fixture = weekFixtureFor(activeScenario)
      return fixture ? Promise.resolve(fixture) : fetchWeekDays(calendarIds)
    },
    refetchInterval: 5 * 60 * 1000,
    enabled: !configPending,
    // The ids are part of the key now, so changing them switches cache
    // entries and would otherwise blank the strip until the new fetch
    // lands. The pre-react-query version of this hook re-read the ids
    // *inside* its fetcher, so the key never changed and the previous week
    // stayed on screen throughout — keep that.
    placeholderData: keepPreviousData,
  })

  return {
    data: query.data ?? null,
    error: query.error ? query.error.message : null,
    isLoading: configPending || query.isLoading,
    refetch: async () => {
      await query.refetch()
    },
  }
}

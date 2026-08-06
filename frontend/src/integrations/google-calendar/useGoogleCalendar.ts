import { usePolling, type UsePollingResult } from '@/hooks/usePolling'
import { activeScenario } from '@/lib/scenario'
import { fetchCalendarIds } from './config'
import { fetchEventsForCalendars } from './events'
import { weekFixtureFor } from './fixtures'
import type { CalendarEvent } from './types'
import { eventLocalDateStr, parseLocalDate, toLocalDateStr } from '@/utils/date'

export interface CalendarDay {
  date: Date
  label: string
  isToday: boolean
  events: CalendarEvent[]
}

export type CalendarData = UsePollingResult<CalendarDay[]>

function dayLabel(date: Date, today: Date): string {
  const diff = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const short = date.toLocaleDateString([], { month: 'numeric', day: 'numeric' })
  if (diff === 0) return `Today ${short}`
  if (diff === 1) return `Tomorrow ${short}`
  return `${date.toLocaleDateString([], { weekday: 'long' })} ${short}`
}

async function fetchCalendarEvents(): Promise<CalendarDay[]> {
  const calendarIds = await fetchCalendarIds()

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

export function useGoogleCalendar(): CalendarData {
  return usePolling<CalendarDay[]>({
    queryKey: ['google-calendar', 'events'],
    fetcher: () => {
      const fixture = weekFixtureFor(activeScenario)
      return fixture ? Promise.resolve(fixture) : fetchCalendarEvents()
    },
    intervalMs: 5 * 60 * 1000,
  })
}

import { usePolling } from '@/hooks/usePolling'
import { activeScenario } from '@/lib/scenario'
import { fetchCalendarIds } from './config'
import { fetchEventsForCalendars } from './events'
import { monthFixtureFor } from './fixtures'
import type { CalendarEvent } from './types'
import { eventLocalDateStr, parseLocalDate, toLocalDateStr } from '@/utils/date'

export interface MonthEvents {
  /** Map of "YYYY-MM-DD" → sorted events for that day */
  byDate: Record<string, CalendarEvent[]>
}

async function fetchMonthEvents(year: number, month: number): Promise<MonthEvents> {
  const calendarIds = await fetchCalendarIds()

  // Calculate date range: first Sunday of the grid to last Saturday
  const firstOfMonth = new Date(year, month, 1)
  const gridStart = new Date(firstOfMonth)
  gridStart.setDate(gridStart.getDate() - gridStart.getDay())

  const lastOfMonth = new Date(year, month + 1, 0)
  const gridEnd = new Date(lastOfMonth)
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()) + 1)

  const startStr = gridStart.toISOString()
  const endStr = gridEnd.toISOString()

  const allEvents = await fetchEventsForCalendars(calendarIds, startStr, endStr)
  const byDate: Record<string, CalendarEvent[]> = {}

  for (const event of allEvents) {
    const dateKey = eventLocalDateStr(event)
    if (!dateKey) continue
    const endKey = eventLocalDateStr({ start: event.end })

    if (dateKey === endKey) {
      if (!byDate[dateKey]) byDate[dateKey] = []
      byDate[dateKey].push(event)
    } else {
      // Multi-day event: add to each day
      const cursor = parseLocalDate(dateKey)
      const end = parseLocalDate(endKey)
      while (cursor < end) {
        const key = toLocalDateStr(cursor)
        if (!byDate[key]) byDate[key] = []
        byDate[key].push(event)
        cursor.setDate(cursor.getDate() + 1)
      }
    }
  }

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
    fetcher: () => {
      const fixture = monthFixtureFor(activeScenario, year, month)
      return fixture ? Promise.resolve(fixture) : fetchMonthEvents(year, month)
    },
    intervalMs: 5 * 60 * 1000,
  })
}

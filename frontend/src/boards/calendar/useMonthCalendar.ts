import { usePolling } from '@/hooks/usePolling'
import { googleCalendarIntegration } from '@/integrations/google-calendar/config'
import type { CalendarEvent } from '@/integrations/google-calendar/types'
import { toLocalDateStr } from '@/utils/date'

export interface MonthEvents {
  /** Map of "YYYY-MM-DD" → sorted events for that day */
  byDate: Record<string, CalendarEvent[]>
}

async function fetchMonthEvents(year: number, month: number): Promise<MonthEvents> {
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
  gridStart.setDate(gridStart.getDate() - gridStart.getDay())

  const lastOfMonth = new Date(year, month + 1, 0)
  const gridEnd = new Date(lastOfMonth)
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()) + 1)

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

    const endDate = event.end.dateTime ?? event.end.date ?? startDate
    const endKey = endDate.substring(0, 10)

    if (dateKey === endKey) {
      if (!byDate[dateKey]) byDate[dateKey] = []
      byDate[dateKey].push(event)
    } else {
      // Multi-day event: add to each day
      const cursor = new Date(dateKey + 'T12:00:00')
      const end = new Date(endKey + 'T12:00:00')
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
    fetcher: () => fetchMonthEvents(year, month),
    intervalMs: 5 * 60 * 1000,
  })
}

import { usePolling, type UsePollingResult } from '@/hooks/usePolling'
import { googleCalendarIntegration } from './config'
import type { CalendarEvent } from './types'
import { toLocalDateStr } from '@/utils/date'

export interface CalendarDay {
  date: Date
  label: string
  isToday: boolean
  events: CalendarEvent[]
}

export type CalendarData = UsePollingResult<CalendarDay[]>

function dayLabel(date: Date, today: Date): string {
  const diff = Math.floor(
    (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return date.toLocaleDateString([], { weekday: 'long' })
}

async function fetchCalendarEvents(): Promise<CalendarDay[]> {
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

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfWeek = new Date(today)
  endOfWeek.setDate(endOfWeek.getDate() + 7)

  const startStr = today.toISOString()
  const endStr = endOfWeek.toISOString()

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

  // Group by date
  const dayMap = new Map<string, CalendarEvent[]>()

  for (let i = 0; i < 7; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    dayMap.set(toLocalDateStr(d), [])
  }

  for (const event of allEvents) {
    const start = event.start.dateTime ?? event.start.date ?? ''
    const dateKey = start.substring(0, 10) // YYYY-MM-DD
    const bucket = dayMap.get(dateKey)
    if (bucket) {
      bucket.push(event)
    }
  }

  const days: CalendarDay[] = []
  const todayStr = toLocalDateStr(today)

  for (const [dateStr, events] of dayMap) {
    const date = new Date(dateStr + 'T12:00:00')
    events.sort((a, b) => {
      const aTime = a.start.dateTime ?? a.start.date ?? ''
      const bTime = b.start.dateTime ?? b.start.date ?? ''
      return aTime.localeCompare(bTime)
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
    fetcher: fetchCalendarEvents,
    intervalMs: 5 * 60 * 1000,
  })
}

import { usePolling, type UsePollingResult } from '@/hooks/usePolling'
import {
  googleCalendarApi,
  configApi,
  type CalendarEvent,
} from '@/lib/dashboard-api'

export type CalendarData = UsePollingResult<CalendarEvent[]>

async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  // Get configured calendars
  let calendarIds: string[] = []
  try {
    const config = await configApi.getAll()
    const saved = config['google_calendar_ids']
    if (saved) {
      calendarIds = JSON.parse(saved)
    }
  } catch {
    // Config not available, try primary
  }

  // Fallback to 'primary' if no calendars configured
  if (calendarIds.length === 0) {
    calendarIds = ['primary']
  }

  const today = new Date()
  const startOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).toISOString()
  const endOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1,
  ).toISOString()

  // Fetch events from all selected calendars in parallel
  const results = await Promise.all(
    calendarIds.map((id) =>
      googleCalendarApi.listEvents(id, startOfDay, endOfDay).catch(() => []),
    ),
  )

  // Merge and sort by start time
  const allEvents = results.flat()
  allEvents.sort((a, b) => {
    const aTime = a.start.dateTime ?? a.start.date ?? ''
    const bTime = b.start.dateTime ?? b.start.date ?? ''
    return aTime.localeCompare(bTime)
  })

  return allEvents
}

export function useGoogleCalendar(): CalendarData {
  return usePolling<CalendarEvent[]>({
    fetcher: fetchCalendarEvents,
    intervalMs: 5 * 60 * 1000,
  })
}

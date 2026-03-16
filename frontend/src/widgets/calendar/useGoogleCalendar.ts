import { usePolling, type UsePollingResult } from '@/hooks/usePolling'
import { googleCalendarApi, type CalendarEvent } from '@/lib/dashboard-api'

export type CalendarData = UsePollingResult<CalendarEvent[]>

export function useGoogleCalendar(calendarId: string): CalendarData {
  return usePolling<CalendarEvent[]>({
    fetcher: () => {
      const today = new Date()
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()
      return googleCalendarApi.listEvents(calendarId, startOfDay, endOfDay)
    },
    intervalMs: 5 * 60 * 1000,
  })
}

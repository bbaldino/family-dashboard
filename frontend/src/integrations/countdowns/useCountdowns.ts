import { usePolling, type UsePollingResult } from '@/hooks/usePolling'
import { useIntegrationConfig } from '@/integrations/use-integration-config'
import { countdownsIntegration } from './config'
// Use the google-calendar integration's API to fetch events
import { googleCalendarIntegration } from '@/integrations/google-calendar/config'
import type { CalendarEvent } from '@/integrations/google-calendar/types'

export interface CountdownItem {
  id: string
  name: string
  date: Date
  daysUntil: number
}

export type CountdownsData = UsePollingResult<CountdownItem[]>

export function useCountdowns(): CountdownsData {
  const config = useIntegrationConfig(countdownsIntegration)

  const calendarId = config?.calendar_id
  const horizonDays = parseInt(config?.horizon_days ?? '90', 10) || 90

  return usePolling<CountdownItem[]>({
    queryKey: ['countdowns', calendarId ?? 'unconfigured'],
    fetcher: async () => {
      if (!calendarId) return []

      const now = new Date()
      const start = now.toISOString()
      const end = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000).toISOString()

      const events = await googleCalendarIntegration.api!.get<CalendarEvent[]>(
        `/events?calendar=${encodeURIComponent(calendarId)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      )

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      return events
        .map((event) => {
          const dateStr = event.start.dateTime ?? event.start.date ?? ''
          // For all-day events (date only), parse as local midnight to avoid UTC offset issues.
          // "2026-05-01" parsed with new Date() becomes midnight UTC = previous day in Pacific.
          const eventDate = event.start.date && !event.start.dateTime
            ? new Date(dateStr + 'T00:00:00') // local midnight
            : new Date(dateStr)
          eventDate.setHours(0, 0, 0, 0)

          const diffMs = eventDate.getTime() - today.getTime()
          const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

          return {
            id: event.id,
            name: event.summary ?? '(No title)',
            date: eventDate,
            daysUntil,
          }
        })
        .filter((item) => item.daysUntil >= 0)
        .sort((a, b) => a.daysUntil - b.daysUntil)
    },
    intervalMs: 60 * 60 * 1000, // hourly
    enabled: !!calendarId,
  })
}

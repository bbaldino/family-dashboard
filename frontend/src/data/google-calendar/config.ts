import { z } from 'zod'
import { defineIntegration } from '@/platform'

export const googleCalendarIntegration = defineIntegration({
  id: 'google-calendar',
  name: 'Google Calendar',
  schema: z.object({
    calendar_ids: z.string().optional(),
  }),
  fields: {
    calendar_ids: {
      label: 'Selected Calendars (JSON)',
      description: 'Managed via calendar picker below',
    },
  },
})

/**
 * Reads the selected calendar IDs out of `/api/config`, falling back to
 * `['primary']` if nothing is configured or the request/parse fails.
 */
export async function fetchCalendarIds(): Promise<string[]> {
  let calendarIds: string[] = []
  try {
    const allConfig: Record<string, string> = await fetch('/api/config').then((r) => r.json())
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
  return calendarIds
}

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
 * The saved `calendar_ids` value as a list, falling back to `['primary']` when
 * nothing is configured, the stored value is not parseable, or it is empty.
 *
 * The one definition of "which calendars" for every caller — the week strip,
 * the month grid and `useCalendarEvents` all reach it through
 * `useIntegrationConfig`, so none of them can drift on the fallback. It
 * replaced a promise-based `fetchCalendarIds` that read `/api/config`
 * itself; that bypassed the shared config query and only stayed current
 * because it happened to run inside a poll's fetcher.
 */
export function parseCalendarIds(saved: string | undefined | null): string[] {
  if (saved) {
    try {
      const parsed: unknown = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[]
    } catch {
      // Unparseable config reads as unconfigured.
    }
  }
  return ['primary']
}

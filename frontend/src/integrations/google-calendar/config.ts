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
 * One definition of "which calendars" for both the promise-based
 * `fetchCalendarIds` below and the `useIntegrationConfig` path in
 * `useCalendarEvents`, so the two cannot drift on the fallback.
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

/**
 * Reads the selected calendar IDs out of `/api/config`, falling back to
 * `['primary']` if nothing is configured or the request/parse fails.
 */
export async function fetchCalendarIds(): Promise<string[]> {
  let saved: string | undefined
  try {
    const allConfig: Record<string, string> = await fetch('/api/config').then((r) => r.json())
    saved = allConfig['google-calendar.calendar_ids']
  } catch {
    // Config not available
  }
  return parseCalendarIds(saved)
}

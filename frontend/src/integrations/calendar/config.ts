import { z } from 'zod'
import { defineIntegration } from '@/platform'

/**
 * The household calendar: the week strip and the month grid, and the one
 * setting that decides what they show.
 *
 * A consumer of the `google-calendar` *provider*, not a service of its own —
 * it has no backend, no routes, and never touches `api`. Every request it
 * makes goes through the provider's synced window (`useCalendarWindow`),
 * which is why the events still arrive from `/api/google-calendar/events`.
 *
 * `calendar_ids` lives here rather than with the provider because it is
 * policy, not capability: countdowns reads a different calendar over a
 * different window through the same connection, and two consumers that could
 * reasonably want a setting configured differently is the definition of a
 * setting that belongs to each of them. The value is migrated across from
 * `google-calendar.calendar_ids` on boot (see `migrate_calendar_config` in
 * the backend's `main.rs`).
 */
export const calendarIntegration = defineIntegration({
  id: 'calendar',
  name: 'Calendar',
  schema: z.object({
    calendar_ids: z.string().optional(),
  }),
  fields: {
    calendar_ids: {
      label: 'Selected Calendars (JSON)',
      description: 'Managed from the Google Calendar settings panel',
    },
  },
})

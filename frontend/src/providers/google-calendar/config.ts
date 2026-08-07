import { z } from 'zod'
import { defineIntegration } from '@/platform'

/**
 * The Google Calendar connection: the OAuth flow at
 * `/api/google-calendar/{auth,callback}` and the operations it unlocks,
 * `/events` and `/calendars`.
 *
 * Kept as `defineIntegration({ id: 'google-calendar' })` so `api` still
 * prefixes `/api/google-calendar` — the provider owns the same routes the
 * integration did, and no Rust route moves.
 *
 * The schema is empty on purpose. Everything a consumer might want set
 * differently is *its* policy: `calendar_ids` belongs to the calendar
 * integration and a single `calendar_id` to countdowns. The credentials the
 * connection does need are the `google-cloud` provider's OAuth client, and
 * the resulting tokens live in the backend — none of it is configured here.
 */
export const googleCalendarProvider = defineIntegration({
  id: 'google-calendar',
  name: 'Google Calendar',
  schema: z.object({}),
  fields: {},
})

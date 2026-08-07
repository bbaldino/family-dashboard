/**
 * A consumer's saved calendar-ids string as a list, falling back to
 * `['primary']` when nothing is configured, the stored value is not
 * parseable, or it is empty.
 *
 * Pure parsing, with no policy in it: *which* calendars, and under which
 * config key, is the consumer's business — this only turns whatever it saved
 * into ids the provider's fetches accept, and knows that `'primary'` is
 * Google's alias for the account's default calendar. That vocabulary is the
 * provider's, and living here is what lets two consumers share the helper
 * without either importing the other.
 *
 * The fallback is never an empty list, deliberately: an empty fan-out renders
 * as a calendar with nothing in it, which is indistinguishable from a quiet
 * week.
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

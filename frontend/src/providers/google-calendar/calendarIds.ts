/**
 * A consumer's saved calendar-ids string as a list, exactly as stored — `[]`
 * when nothing is configured, the stored value is not parseable, or it is
 * empty.
 *
 * Pure parsing, with no policy in it: *which* calendars, and under which
 * config key, is the consumer's business — this only turns whatever it saved
 * into ids the provider's fetches accept. That vocabulary is the provider's,
 * and living here is what lets two consumers share the helper without either
 * importing the other.
 *
 * This is the edit-surface reading: it must show exactly what is stored, not
 * a fetch's default. Reach for `readCalendarIdsOrDefault` instead wherever a
 * fallback to `'primary'` is wanted — an admin panel that seeded from that
 * fallback would bundle in the default calendar invisibly, with no checkbox
 * to untick it by (Google never hands back the literal string `'primary'`).
 */
export function readStoredCalendarIds(saved: string | undefined | null): string[] {
  if (saved) {
    try {
      const parsed: unknown = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[]
    } catch {
      // Unparseable config reads as unconfigured.
    }
  }
  return []
}

/**
 * `readStoredCalendarIds`, with `'primary'` — Google's alias for the
 * account's default calendar — substituted in when nothing usable is
 * stored.
 *
 * This is fetch-time policy: "if the user has configured nothing, read the
 * account's default calendar" is a reasonable thing for a fetch to assume
 * and a wrong thing for an edit surface to assume. The fallback is never an
 * empty list, deliberately: an empty fan-out renders as a calendar with
 * nothing in it, which is indistinguishable from a quiet week. Use this in
 * fetch paths only; admin panels want `readStoredCalendarIds`.
 */
export function readCalendarIdsOrDefault(saved: string | undefined | null): string[] {
  const stored = readStoredCalendarIds(saved)
  return stored.length > 0 ? stored : ['primary']
}

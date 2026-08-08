export interface CalendarEvent {
  id: string
  summary?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  description?: string
  location?: string
}

export interface CalendarListEntry {
  id: string
  summary: string
  primary?: boolean
}

/**
 * One configured calendar's contribution to a set of events, and its health.
 *
 * Kept per calendar rather than flattened because a calendar that could not
 * be read still resolves `events` to `[]` — indistinguishable from a
 * genuinely empty one unless `error` is tracked alongside it. On 2026-08-07,
 * telling those apart took a manual 12-month probe against the backend
 * before `useCalendarWindow` and `useCalendarRange` started keeping each
 * calendar's error separately.
 */
export interface CalendarSourceEntry {
  calendarId: string
  /** `[]` both while it loads and when it failed — read `error` to tell. */
  events: CalendarEvent[]
  /** Non-null when this calendar could not be read. */
  error: Error | null
  isLoading: boolean
}

/**
 * Some span of events, however they were obtained.
 *
 * Shared by the window sync and the range resolver so that a consumer reads
 * the same shape whether its events came off the window or off a fetch it
 * provoked — which is what lets `useCalendarRange` choose between the two
 * without its callers knowing that a choice was made.
 */
export interface CalendarRange {
  /** Every readable calendar's events, in configured-calendar order. */
  events: CalendarEvent[]
  /** One entry per configured calendar, in configured order. */
  calendars: CalendarSourceEntry[]
  isLoading: boolean
  /**
   * Set only when *no* calendar could be read.
   *
   * A partial failure is deliberately not an error here: several calendars
   * mean several ways to lose one, and a revoked share must not blank the
   * others. Which ones failed is in `calendars` — that is where a caller
   * looks to distinguish a broken calendar from a quiet one.
   */
  error: Error | null
  refetch: () => Promise<void>
}

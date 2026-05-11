/** Format a Date as YYYY-MM-DD in local timezone (not UTC) */
export function toLocalDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Parse a YYYY-MM-DD string as a local-midnight Date.
 * Direct `new Date("2026-05-10")` parses as UTC midnight, which becomes
 * the previous day in negative-offset zones (e.g. Pacific).
 */
export function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00')
}

/**
 * Get the local YYYY-MM-DD date for a Google Calendar event.
 * All-day events carry `start.date` as a local date string; timed events
 * carry `start.dateTime` as a UTC ISO string. Bucketing by raw substring
 * works for the former but shifts timed events to the wrong day in
 * negative-offset zones.
 */
export function eventLocalDateStr(event: {
  start: { date?: string; dateTime?: string }
}): string {
  const start = event.start.dateTime ?? event.start.date ?? ''
  return event.start.date && !event.start.dateTime
    ? start.substring(0, 10)
    : toLocalDateStr(new Date(start))
}

import type { Incident } from './types'

/** `null` means ongoing. See `Incident.ended_at`. */
export function isOngoing(incident: Incident): boolean {
  return incident.ended_at === null
}

/**
 * Durations in the mock's register: `22m`, `1h 50m`. Sub-minute incidents keep
 * their seconds — they still happened, and "0m" reads as nothing at all.
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

const WEEKDAY_TIME = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const DATE_TIME = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/**
 * The ledger's left column — `THU 04:12` in the mock.
 *
 * Incidents are returned whole, so a seven-day ledger can hold a row that began
 * before its window. A bare weekday would date such a row to the wrong week, so
 * anything older than six days is shown as a date instead.
 */
export function formatIncidentWhen(
  incident: Incident,
  now: number = Math.floor(Date.now() / 1000),
): string {
  const ageDays = (now - incident.started_at) / 86_400
  const when = new Date(incident.started_at * 1000)
  const text = ageDays > 6 ? DATE_TIME.format(when) : WEEKDAY_TIME.format(when)
  return text.replace(',', '').toUpperCase()
}

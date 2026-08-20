import type { CalendarEvent } from '@/providers/google-calendar'

/** Google marks all-day events with a date-only start (no dateTime). */
export function isAllDay(event: CalendarEvent): boolean {
  return !event.start.dateTime && !!event.start.date
}

/**
 * An all-day event whose title ends in "birthday" — "Grandpa's birthday",
 * "Grandpa Birthday". Requiring all-day and an *ending* match keeps out the
 * household's timed "bday party" events and titles that merely mention a
 * birthday mid-string (a "birthday cake pickup"), the same discipline the
 * datebook Tally's birthday count relies on — this is the shared classifier
 * for both. Broader than "'s birthday" alone so it catches the possessive-less
 * spelling this household actually uses.
 */
export function isBirthdayEvent(event: CalendarEvent): boolean {
  if (event.start.dateTime) return false
  return /\bbirthday$/i.test((event.summary ?? '').trim())
}

/** 'ALL DAY' or a wall-clock time. Never throws — a malformed event renders blank. */
export function formatEventTime(event: CalendarEvent): string {
  if (isAllDay(event)) return 'ALL DAY'
  if (!event.start.dateTime) return ''
  const date = new Date(event.start.dateTime)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** Compact "time until" for the masthead standfirst's next-event summary
 *  (mock: `broadsheet-v2.jsx:132`, `d.nextEvent.in`) — e.g. "1h 43m" or
 *  "12m". Clamped to zero rather than going negative: callers pass an
 *  already-filtered "not yet started" event, but a clock tick landing
 *  between renders shouldn't ever print a negative number on the wall. */
export function formatTimeUntil(target: Date, now: Date): string {
  const totalMinutes = Math.max(0, Math.round((target.getTime() - now.getTime()) / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

/** The masthead standfirst row's right-hand label: `Next in 1h 43m` for a
 *  timed event, `Next today` for an all-day one (no clock time to count
 *  down from), or `Tomorrow first` once today's docket is empty. Mock:
 *  `broadsheet-v2.jsx:132` — `hasToday ? \`Next in ${d.nextEvent.in}\` :
 *  'Tomorrow first'`. */
export function nextEventLabel(event: CalendarEvent | undefined, now: Date): string {
  if (!event) return 'Tomorrow first'
  if (!event.start.dateTime) return 'Next today'
  const start = new Date(event.start.dateTime)
  if (Number.isNaN(start.getTime())) return 'Next today'
  return `Next in ${formatTimeUntil(start, now)}`
}

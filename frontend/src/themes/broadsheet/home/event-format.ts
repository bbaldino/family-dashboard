import type { CalendarEvent } from '@/data/google-calendar'

/** Google marks all-day events with a date-only start (no dateTime). */
export function isAllDay(event: CalendarEvent): boolean {
  return !event.start.dateTime && !!event.start.date
}

/** 'ALL DAY' or a wall-clock time. Never throws — a malformed event renders blank. */
export function formatEventTime(event: CalendarEvent): string {
  if (isAllDay(event)) return 'ALL DAY'
  if (!event.start.dateTime) return ''
  const date = new Date(event.start.dateTime)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

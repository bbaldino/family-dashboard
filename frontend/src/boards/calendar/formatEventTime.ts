import type { CalendarEvent } from '@/integrations/google-calendar/types'

/** Compact time for day cell pills (e.g. "5p", "10:30a") */
export function formatEventTimeCompact(event: CalendarEvent): string | null {
  if (!event.start.dateTime) return null
  const d = new Date(event.start.dateTime)
  const h = d.getHours()
  const m = d.getMinutes()
  const suffix = h >= 12 ? 'p' : 'a'
  const hour = h % 12 || 12
  return m === 0 ? `${hour}${suffix}` : `${hour}:${m.toString().padStart(2, '0')}${suffix}`
}

/** Full time range for day detail modal (e.g. "5:00 PM – 6:30 PM" or "All day") */
export function formatEventTimeFull(event: CalendarEvent): string {
  if (!event.start.dateTime) return 'All day'
  const start = new Date(event.start.dateTime)
  let time = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (event.end.dateTime) {
    const end = new Date(event.end.dateTime)
    time += ' – ' + end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  return time
}

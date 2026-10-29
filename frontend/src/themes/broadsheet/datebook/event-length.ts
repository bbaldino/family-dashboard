import type { CalendarEvent } from '@/providers/google-calendar'

/**
 * How long a timed event runs — "20 min", "1 hr", "1 hr 30 min" — for the day
 * sheet's detail line. `null` when there is nothing true to say: an all-day
 * event, or an end that is missing, unparseable, or not after the start.
 */
export function formatEventLength(event: CalendarEvent): string | null {
  if (!event.start.dateTime || !event.end.dateTime) return null
  const ms = new Date(event.end.dateTime).getTime() - new Date(event.start.dateTime).getTime()
  if (!(ms > 0)) return null
  const minutes = Math.round(ms / 60_000)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`
}

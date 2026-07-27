/**
 * Human-friendly "when is this game" label:
 *   in-progress / just kicked → bare time ("9:00 PM")
 *   later today → "Today 9:00 PM"
 *   tomorrow (calendar day) → "Tomorrow 9:00 PM"
 *   further out → "Wed 9:00 PM" (or "Wed Oct 5, 9:00 PM" past 7 days)
 */
export function formatUpcomingTime(startTime: string): string {
  const start = new Date(startTime)
  const now = new Date()
  const diffHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60)

  const timeStr = start.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })

  if (diffHours < 0) return timeStr
  if (diffHours < 12) return `Today ${timeStr}`

  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (start.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow ${timeStr}`
  }

  // Within a week: weekday name is unambiguous. Past that, add the date.
  if (diffHours < 24 * 7) {
    return `${start.toLocaleDateString([], { weekday: 'short' })} ${timeStr}`
  }
  return `${start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}, ${timeStr}`
}

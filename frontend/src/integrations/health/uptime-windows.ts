import type { Incident } from './types'

export interface UptimeWindow {
  label: string
  /** Percentage of monitored time in the window that was not in incident,
   *  0–100. `null` when the window cannot be computed — no monitors. */
  pct: number | null
}

const HOUR = 3600
export const WINDOWS: readonly { label: string; secs: number }[] = [
  { label: '24 hours', secs: 24 * HOUR },
  { label: '7 days', secs: 7 * 24 * HOUR },
  { label: '30 days', secs: 30 * 24 * HOUR },
]

/**
 * Fleet uptime over each window, from the incident ledger.
 *
 * **Derived from incidents rather than the per-service uptime reports**, for
 * one reason: `/uptime/{id}` is per service and per window, so three windows
 * across eight monitors is twenty-four requests for one masthead ear, while
 * `/incidents?since=` returns the whole period in one. The reports stay the
 * source for the per-service bars, which need the shape of the outage rather
 * than its total.
 *
 * The design derives its longer windows by decaying the 24-hour shortfall
 * (7d = 42% of it, 30d = 23%). That is a smoothing of one number, not a
 * measurement — real durations are available here, so real durations are what
 * these use.
 *
 * An incident is clipped to the window rather than counted whole: an outage
 * that began four days ago contributes only its last 24 hours to the 24-hour
 * figure. `ended_at: null` means ongoing, so it is clipped at `now` — its
 * `duration_secs` is counted to now and would keep growing past the window.
 */
export function computeUptimeWindows(
  incidents: Incident[],
  monitorCount: number,
  now: number,
): UptimeWindow[] {
  return WINDOWS.map(({ label, secs }) => {
    if (monitorCount <= 0) return { label, pct: null }

    const windowStart = now - secs
    let downSecs = 0

    for (const incident of incidents) {
      const start = Math.max(incident.started_at, windowStart)
      const end = Math.min(incident.ended_at ?? now, now)
      if (end > start) downSecs += end - start
    }

    // Every monitor contributes the full window of possible up-time, so a
    // single service being down all day is one eighth of a fleet's day, not
    // all of it.
    const possible = secs * monitorCount
    const pct = 100 * (1 - downSecs / possible)
    return { label, pct: Math.min(100, Math.max(0, pct)) }
  })
}

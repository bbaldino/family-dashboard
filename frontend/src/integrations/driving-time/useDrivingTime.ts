import { useState, useEffect, useCallback } from 'react'
import { drivingTimeIntegration } from './config'
import { googleCloudProvider } from '@/providers/google-cloud'
import { useIntegrationConfig } from '@/platform'
import type { CalendarEvent } from '@/integrations/google-calendar'
import type { EventDriveInfo, DriveUrgency } from './types'

function computeUrgency(minutesUntilLeave: number): DriveUrgency {
  if (minutesUntilLeave > 30) return 'ok'
  if (minutesUntilLeave > 5) return 'soon'
  return 'urgent'
}

function computeDisplayText(
  urgency: DriveUrgency,
  durationText: string,
  minutesUntilLeave: number,
): string {
  if (urgency === 'ok') return `${durationText} drive`
  if (urgency === 'urgent') return 'Leave now!'
  return `Leave in ${Math.max(0, Math.round(minutesUntilLeave))} min`
}

/** Compute refresh interval (ms) based on time until nearest event */
function computeRefreshInterval(events: CalendarEvent[]): number {
  const now = Date.now()
  let nearestMinutes = Infinity

  for (const e of events) {
    const start = e.start.dateTime ?? e.start.date
    if (!start) continue
    const mins = (new Date(start).getTime() - now) / 60000
    if (mins > 0 && mins < nearestMinutes) nearestMinutes = mins
  }

  if (nearestMinutes > 120) return 30 * 60000
  if (nearestMinutes > 60) return 15 * 60000
  if (nearestMinutes > 30) return 10 * 60000
  return 5 * 60000
}

/** The only field this hook reads out of Google's Routes API response. */
interface RoutesResponse {
  routes?: { duration?: string }[]
}

/**
 * Cache the Routes API response for as long as the hook's tightest poll
 * cadence — `computeRefreshInterval`'s 5-minute floor, which kicks in once a
 * journey is imminent. Long enough to absorb re-renders within one poll
 * window; never so long that a refetch triggered by the tightened
 * imminent-departure cadence could be served a duration older than that
 * cadence itself.
 */
const ROUTE_TTL_SECS = 5 * 60

/**
 * Parse "1080s" -> 1080, mirroring the deleted Rust route's
 * `duration_str.trim_end_matches('s').parse().unwrap_or(0)`.
 */
function parseDurationSecs(raw: string): number {
  const n = parseInt(raw.replace(/s+$/, ''), 10)
  return Number.isFinite(n) ? n : 0
}

/**
 * Format seconds the same way the deleted Rust route did: >=3600s as hours
 * (plus minutes when the remainder isn't a whole hour), otherwise minutes —
 * rounded *up*, matching the Rust's `(duration_secs + 59) / 60` integer
 * division, so 59s reads "1 min" rather than "0 min".
 */
export function formatDuration(durationSecs: number): string {
  if (durationSecs >= 3600) {
    const hours = Math.floor(durationSecs / 3600)
    const mins = Math.floor((durationSecs % 3600) / 60)
    return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`
  }
  return `${Math.floor((durationSecs + 59) / 60)} min`
}

/**
 * POST to the fetch capability, composed exactly like the deleted Rust
 * route's outbound call to Google Routes — method, both `X-Goog-*` headers,
 * and the request body — so the composed shape is stable enough to pin in a
 * test.
 */
async function fetchRouteDuration(
  homeAddress: string,
  apiKey: string,
  destination: string,
): Promise<number> {
  const resp = await fetch('/api/fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://routes.googleapis.com/directions/v2:computeRoutes',
      method: 'POST',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.duration',
      },
      body: {
        origin: { address: homeAddress },
        destination: { address: destination },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
      },
      ttl_secs: ROUTE_TTL_SECS,
    }),
  })
  if (!resp.ok) {
    throw new Error(`routes request failed: ${resp.status}`)
  }
  // `.text()` + `JSON.parse`, not `.json()` — matches `useIntegrationQuery`'s
  // fetch-capability call, so both call sites read an `/api/fetch` response
  // the same way.
  const text = await resp.text()
  // An empty body is a failure, not an empty result. `.json()` used to throw
  // here, which skipped the update and left the destination showing nothing.
  // Falling through instead would hit the `?? '0s'` below and render a
  // confident "0 min drive" — on a wall display that reads as "leave now",
  // which is worse than showing no estimate at all.
  if (!text) {
    throw new Error('routes response was empty')
  }
  const data = JSON.parse(text) as RoutesResponse
  // Mirrors the Rust's `.unwrap_or("0s")` — an upstream success carrying a
  // parseable body but no route still produces a zero duration rather than
  // being treated as a failure. Ported deliberately; only the empty-body case
  // above diverges from it.
  const raw = data.routes?.[0]?.duration ?? '0s'
  return parseDurationSecs(raw)
}

export function useDrivingTime(events: CalendarEvent[]) {
  const [driveInfo, setDriveInfo] = useState<Record<string, EventDriveInfo>>({})
  const [fetchTick, setFetchTick] = useState(0)

  // The two config sources this hook depends on. `useIntegrationData` only
  // resolves an integration's *own* config, and a dynamic fan-out over N
  // destinations can't be N hooks (hooks can't run in a loop) — so this
  // integration reads both configs itself and calls `POST /api/fetch`
  // directly. See `fetchRouteDuration` and the effect below.
  const dtConfig = useIntegrationConfig(drivingTimeIntegration)
  const gcConfig = useIntegrationConfig(googleCloudProvider)

  // Filter to events within 24 hours with a location
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const relevantEvents = events.filter((e) => {
    if (!e.location) return false
    const start = e.start.dateTime ?? e.start.date
    if (!start) return false
    const startDate = new Date(start)
    return startDate > now && startDate < tomorrow
  })

  const relevantKey = relevantEvents.map((e) => e.id).join(',')

  const updateDriveInfo = useCallback(
    (destination: string, durationSecs: number, durationText: string, bufferMinutes: number) => {
      const bufferMs = bufferMinutes * 60 * 1000
      const durationMs = durationSecs * 1000

      setDriveInfo((prev) => {
        const next = { ...prev }
        for (const event of relevantEvents) {
          if (event.location !== destination) continue
          const start = event.start.dateTime ?? event.start.date
          if (!start) continue
          const startDate = new Date(start)
          const leaveByTime = new Date(startDate.getTime() - durationMs - bufferMs)
          const minutesUntilLeave = (leaveByTime.getTime() - Date.now()) / 60000
          const urgency = computeUrgency(minutesUntilLeave)
          next[event.id] = {
            durationSeconds: durationSecs,
            durationText,
            leaveByTime,
            minutesUntilLeave,
            urgency,
            displayText: computeDisplayText(urgency, durationText, minutesUntilLeave),
          }
        }
        return next
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [relevantKey],
  )

  // Fetch driving times for unique destinations (serialized)
  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      const homeAddress = dtConfig?.home_address ?? ''
      const apiKey = gcConfig?.api_key ?? ''
      const bufferMinutes = dtConfig?.buffer_minutes ?? 5

      const destinations = new Map<string, string>()

      for (const event of relevantEvents) {
        const dest = event.location!
        const start = event.start.dateTime ?? event.start.date ?? ''
        // Keep the earliest event start for each destination
        if (!destinations.has(dest) || start < destinations.get(dest)!) {
          destinations.set(dest, start)
        }
      }

      for (const [destination] of destinations) {
        if (cancelled) break

        try {
          const durationSecs = await fetchRouteDuration(homeAddress, apiKey, destination)
          updateDriveInfo(destination, durationSecs, formatDuration(durationSecs), bufferMinutes)
        } catch {
          // Don't block other destinations on failure
        }
      }
    }

    // Nothing may fire until the driving-time config has resolved *and* the
    // google-cloud provider's api_key is actually set. `googleCloudProvider`'s
    // schema is all-optional (other consumers read only a subset of its
    // keys), so `gcConfig` itself turns non-null the instant `/api/config`
    // resolves, whether or not `api_key` was ever configured — checking the
    // object is not checking the value this hook needs. Without gating on
    // `api_key` specifically, the first request after a cold load (or an
    // install that never set the key) would go out with an empty
    // `X-Goog-Api-Key` header — Google's Routes API returns a 403 for that,
    // which reads like a bad key rather than the load-order race, or missing
    // config, it actually is.
    if (relevantEvents.length > 0 && dtConfig && gcConfig?.api_key) {
      fetchAll()
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relevantKey, fetchTick, updateDriveInfo, dtConfig, gcConfig])

  // Adaptive polling: refresh driving times based on proximity to nearest event
  useEffect(() => {
    if (relevantEvents.length === 0) return

    const intervalMs = computeRefreshInterval(relevantEvents)
    const timer = setInterval(() => {
      setFetchTick((t) => t + 1)
    }, intervalMs)

    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relevantKey])

  // Recalculate urgency every minute (countdown text updates without refetching)
  useEffect(() => {
    const interval = setInterval(() => {
      setDriveInfo((prev) => {
        const next = { ...prev }
        for (const [id, info] of Object.entries(next)) {
          const minutesUntilLeave = (info.leaveByTime.getTime() - Date.now()) / 60000
          const urgency = computeUrgency(minutesUntilLeave)
          next[id] = {
            ...info,
            minutesUntilLeave,
            urgency,
            displayText: computeDisplayText(urgency, info.durationText, minutesUntilLeave),
          }
        }
        return next
      })
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  return driveInfo
}

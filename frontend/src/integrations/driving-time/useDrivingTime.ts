import { useEffect, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { drivingTimeIntegration } from './config'
import { googleCloudProvider } from '@/providers/google-cloud'
import { fetchViaProxy, integrationQueryKey, useIntegrationConfig } from '@/platform'
import type { ProxyFetchSpec } from '@/platform'
import type { CalendarEvent } from '@/providers/google-calendar'
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

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes'

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
 * One proxied call to Google Routes, composed exactly like the deleted Rust
 * route's outbound call — method, both `X-Goog-*` headers, and the request
 * body — so the composed shape is stable enough to pin in a test.
 *
 * Built as a `ProxyFetchSpec` rather than a hand-written `POST /api/fetch`
 * because the spec is also the cache key (`integrationQueryKey`): two
 * consumers asking for the same destination land on one entry, and one
 * request.
 */
function routeSpec(homeAddress: string, apiKey: string, destination: string): ProxyFetchSpec {
  return {
    url: ROUTES_URL,
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
    ttlSecs: ROUTE_TTL_SECS,
  }
}

async function fetchRouteDuration(spec: ProxyFetchSpec): Promise<number> {
  const data = await fetchViaProxy<RoutesResponse | undefined>(spec)
  // An empty body is a failure, not an empty result — `fetchViaProxy` relays
  // one as `undefined`. Falling through instead would hit the `?? '0s'` below
  // and render a confident "0 min drive"; on a wall display that reads as
  // "leave now", which is worse than showing no estimate at all.
  if (!data) {
    throw new Error('routes response was empty')
  }
  // Mirrors the Rust's `.unwrap_or("0s")` — an upstream success carrying a
  // parseable body but no route still produces a zero duration rather than
  // being treated as a failure. Ported deliberately; only the empty-body case
  // above diverges from it.
  return parseDurationSecs(data.routes?.[0]?.duration ?? '0s')
}

/**
 * A clock, not a fetch trigger: the countdown text ("Leave in 12 min") and the
 * urgency band are derived from *now*, so they have to move on their own even
 * when no new duration has arrived. react-query owns re-fetching; this owns
 * re-rendering the minute.
 */
function useMinuteTick(): number {
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])
  return nowMs
}

/**
 * Drive time and leave-by countdown per calendar event, keyed by event id.
 *
 * A fan-out over N destinations is `useQueries`, not N hooks: the destination
 * list has a runtime length, so it cannot be N `useIntegrationQuery` calls —
 * but it is still react-query, with its caching, dedup, retry and immediate
 * config invalidation, rather than a hand-rolled effect.
 */
export function useDrivingTime(events: CalendarEvent[]): Record<string, EventDriveInfo> {
  const dtConfig = useIntegrationConfig(drivingTimeIntegration)
  const gcConfig = useIntegrationConfig(googleCloudProvider)
  const nowMs = useMinuteTick()

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

  const homeAddress = dtConfig?.home_address ?? ''
  const apiKey = gcConfig?.api_key ?? ''
  const bufferMinutes = dtConfig?.buffer_minutes ?? 5

  // Nothing may fire until the driving-time config has resolved *and* the
  // google-cloud provider's api_key is actually set. `googleCloudProvider`'s
  // schema is all-optional (other consumers read only a subset of its keys),
  // so `gcConfig` itself turns non-null the instant `/api/config` resolves,
  // whether or not `api_key` was ever configured — checking the object is not
  // checking the value this hook needs. Without gating on `api_key`
  // specifically, the first request after a cold load (or an install that
  // never set the key) would go out with an empty `X-Goog-Api-Key` header —
  // Google's Routes API returns a 403 for that, which reads like a bad key
  // rather than the load-order race, or missing config, it actually is.
  const configReady = Boolean(dtConfig && gcConfig?.api_key)

  // One query per *destination*, not per event: several events at the same
  // place are one journey. (Identical keys would share a cache entry anyway;
  // this keeps the observer count down too.)
  const destinations = [...new Set(relevantEvents.map((e) => e.location!))]

  const results = useQueries({
    queries: destinations.map((destination) => {
      const spec = routeSpec(homeAddress, apiKey, destination)
      return {
        queryKey: integrationQueryKey(drivingTimeIntegration.id, spec),
        queryFn: () => fetchRouteDuration(spec),
        enabled: configReady,
        // Matches the backend's own TTL for this request: a refetch inside
        // that window would be answered from the proxy cache with the same
        // bytes, so there is nothing to gain by making it.
        staleTime: ROUTE_TTL_SECS * 1000,
        // The pre-react-query hook polled on `computeRefreshInterval`, an
        // adaptive cadence that tightens from 30 minutes to 5 as the nearest
        // journey approaches. Same function, same thresholds — but as the
        // callback form, so react-query re-evaluates it after each fetch
        // instead of freezing the cadence at whatever the gap was when the
        // event list last changed, which is what the old `setInterval` did.
        refetchInterval: () => computeRefreshInterval(relevantEvents),
      }
    }),
  })

  // Zip destinations with results by index *here*, where the two arrays are
  // known to correspond, and look events up by destination afterwards. A map
  // built from the results array alone would slide every later entry up by
  // one when a destination has no result yet — the wrong drive time on the
  // wrong event, rendered perfectly plausibly.
  const secondsByDestination = new Map<string, number>()
  destinations.forEach((destination, i) => {
    const secs = results[i]?.data
    if (secs !== undefined) secondsByDestination.set(destination, secs)
  })

  const driveInfo: Record<string, EventDriveInfo> = {}
  for (const event of relevantEvents) {
    const durationSeconds = secondsByDestination.get(event.location!)
    if (durationSeconds === undefined) continue
    const start = event.start.dateTime ?? event.start.date
    if (!start) continue

    const startDate = new Date(start)
    const leaveByTime = new Date(
      startDate.getTime() - durationSeconds * 1000 - bufferMinutes * 60 * 1000,
    )
    const minutesUntilLeave = (leaveByTime.getTime() - nowMs) / 60000
    const urgency = computeUrgency(minutesUntilLeave)
    const durationText = formatDuration(durationSeconds)
    driveInfo[event.id] = {
      durationSeconds,
      durationText,
      leaveByTime,
      minutesUntilLeave,
      urgency,
      displayText: computeDisplayText(urgency, durationText, minutesUntilLeave),
    }
  }

  return driveInfo
}

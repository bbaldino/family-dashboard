import { useQueries, useQuery } from '@tanstack/react-query'
import { bucketSegments, windowEndOf, BLOCKS_24H } from './uptime'
import { computeUptimeWindows, type UptimeWindow } from './uptime-windows'
import { healthIntegration } from './config'
import type { HistorySample, Incident, Service, Status, UptimeReport } from './types'

const { api } = healthIntegration

const DAY_SECS = 86_400

/** The board polls faster than the services do; the mock's masthead says so
 *  out loud ("REFRESHING EVERY 10s"), so the number has to be real. */
export const REFRESH_MS = 10_000

/** The detail panels behind an expanded card: fetched once on open, then left
 *  alone. A day-long window and a 20-row log do not move in a minute. */
const DETAIL_STALE_MS = 60_000

export function useHealthServices() {
  return useQuery({
    queryKey: ['health', 'status'],
    queryFn: () => api.get<Service[]>('/status'),
    refetchInterval: REFRESH_MS,
  })
}

/** One cache entry per service's 24-hour report, shared by both uptime hooks
 *  below — two fetchers under one key is how a screen ends up reading data
 *  another screen's fetcher put there. */
const uptimeQueryKey = (serviceId: number) => ['health', 'uptime', serviceId]
const fetchUptime = (serviceId: number) =>
  api.get<UptimeReport>(`/uptime/${serviceId}?window=${DAY_SECS}`)

export interface ServiceUptime {
  /** `BLOCKS_24H` statuses, oldest first — ready for the bar. */
  blocks: Status[]
  percentOk: number | null
}

/**
 * One 24-hour uptime report per service, resampled for the bar.
 *
 * Queried per service because that's the shape of the API (`/uptime/{id}`).
 * Refetched a good deal more slowly than the status board: a day-long window
 * barely moves in ten seconds, and this is one request per monitor.
 */
export function useServiceUptime(services: Service[]): Record<number, ServiceUptime> {
  const results = useQueries({
    queries: services.map((s) => ({
      queryKey: uptimeQueryKey(s.id),
      queryFn: () => fetchUptime(s.id),
      refetchInterval: 60_000,
    })),
  })

  const blank = () => Array.from({ length: BLOCKS_24H }, () => 'unknown' as Status)
  const byId: Record<number, ServiceUptime> = {}
  services.forEach((s, i) => {
    const report = results[i]?.data
    const end = report ? windowEndOf(report.segments) : null
    byId[s.id] =
      report && end !== null
        ? {
            blocks: bucketSegments(report.segments, end, report.window_secs || DAY_SECS),
            percentOk: report.percent_ok,
          }
        : { blocks: blank(), percentOk: null }
  })
  return byId
}

/**
 * The same 24-hour report as `useServiceUptime`, for **one** service and only
 * while its card is open — the shape a card-per-service board wants, where
 * `useServiceUptime` fans out over every service at once for a board that
 * draws them all.
 *
 * Deliberately a second hook over the same query rather than options on
 * `useServiceUptime`: the callers differ in how many services they ask about
 * and in when they ask, and react-query resolves `enabled` per observer.
 * Sharing `uptimeQueryKey` and `fetchUptime` is what matters — one endpoint,
 * one cache entry per service, one fetcher — while each caller keeps its own
 * fetch policy. Two fetchers under one key is precisely the hazard: whichever
 * ran first would fill the entry for both.
 *
 * Returns the raw report rather than `ServiceUptime` blocks; the caller draws
 * its own bar and reads `percent_ok` directly.
 */
export function useUptimeReport(serviceId: number, { enabled = true } = {}) {
  return useQuery({
    queryKey: uptimeQueryKey(serviceId),
    queryFn: () => fetchUptime(serviceId),
    enabled,
    staleTime: DETAIL_STALE_MS,
  })
}

/**
 * The recent status samples for one service — the raw poll log behind an
 * expanded card, newest first.
 *
 * The row cap is passed because upstream has no useful default here (unlike
 * the incident ledger's window), and it is part of the cache key: a card
 * showing twenty rows must not be served a ten-row response cached by someone
 * asking for less.
 */
export function useServiceHistory(serviceId: number, { limit = 20, enabled = true } = {}) {
  return useQuery({
    queryKey: ['health', 'history', serviceId, limit],
    queryFn: () => api.get<HistorySample[]>(`/history/${serviceId}?limit=${limit}`),
    enabled,
    staleTime: DETAIL_STALE_MS,
  })
}

/**
 * The cross-monitor ledger behind the board — homelab-health's
 * `/api/v1/incidents`, proxied by our backend because the dashboard is served
 * over HTTPS and the health service is plain HTTP on the LAN.
 *
 * Upstream owns the defaults (a seven-day window, newest first), so nothing is
 * passed but the row cap; duplicating its window here would give the two of us
 * separate opinions about what a week is.
 */
export function useIncidents(limit = 40) {
  return useQuery({
    queryKey: ['health', 'incidents', limit],
    queryFn: () => api.get<Incident[]>(`/incidents?limit=${limit}`),
    refetchInterval: 60_000,
  })
}

/** The longest window the uptime ear reports. One request covers all three:
 *  the shorter windows are filtered out of the same list. */
const UPTIME_LEDGER_SECS = 30 * 24 * 3600

/**
 * Fleet uptime over 24 hours, 7 days and 30 days, for the masthead's ear.
 *
 * Unlike `useIncidents` — which deliberately passes no window, so that
 * upstream keeps the only opinion about what "recent" means — this one must
 * name its own: the ear reports a 30-day figure, and upstream's default is a
 * week. The window is computed inside the fetcher rather than in the query
 * key, so the key stays stable and the request does not re-fire every second.
 *
 * See `computeUptimeWindows` for why this reads the incident ledger rather
 * than the per-service uptime reports.
 */
export function useUptimeWindows(): UptimeWindow[] {
  const { data: services } = useHealthServices()
  const { data: incidents } = useQuery({
    queryKey: ['health', 'incidents', 'uptime-windows'],
    queryFn: () => {
      const since = Math.floor(Date.now() / 1000) - UPTIME_LEDGER_SECS
      return api.get<Incident[]>(`/incidents?since=${since}&limit=500`)
    },
    refetchInterval: 5 * 60_000,
  })

  return computeUptimeWindows(incidents ?? [], services?.length ?? 0, Math.floor(Date.now() / 1000))
}

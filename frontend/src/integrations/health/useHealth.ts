import { useQueries, useQuery } from '@tanstack/react-query'
import { bucketSegments, windowEndOf, BLOCKS_24H } from './uptime'
import { fetchJson } from './fetchJson'
import type { Incident, Service, Status, UptimeReport } from './types'

const DAY_SECS = 86_400

/** The board polls faster than the services do; the mock's masthead says so
 *  out loud ("REFRESHING EVERY 10s"), so the number has to be real. */
export const REFRESH_MS = 10_000

export function useHealthServices() {
  return useQuery({
    queryKey: ['health', 'status'],
    queryFn: () => fetchJson<Service[]>('/api/health/status'),
    refetchInterval: REFRESH_MS,
  })
}

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
      queryKey: ['health', 'uptime', s.id],
      queryFn: () => fetchJson<UptimeReport>(`/api/health/uptime/${s.id}?window=${DAY_SECS}`),
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
    queryFn: () => fetchJson<Incident[]>(`/api/health/incidents?limit=${limit}`),
    refetchInterval: 60_000,
  })
}

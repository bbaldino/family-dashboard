export type Status = 'ok' | 'degraded' | 'critical' | 'unknown' | null

export interface HealthComponent {
  name: string
  status: Status
  critical: boolean
  message: string | null
}

export interface Service {
  id: number
  name: string
  type_id: string
  interval_secs: number
  enabled: boolean
  status: Status
  message: string | null
  components: HealthComponent[]
  updated_at: string | null
  /**
   * The last 24 hours of this monitor's incidents, newest first, capped at five
   * upstream — enough for the lead story without a second request. An ongoing
   * incident always appears with its true start even when that is older than
   * the window, so a long outage cannot silently under-report.
   *
   * An empty array is a trustworthy zero: genuinely no incidents. Absent on
   * older payloads, hence optional.
   */
  recent_incidents?: Incident[]
}

export interface UptimeSegment {
  status: Status
  /** Unix seconds. */
  start: number
  end: number
}

export interface UptimeReport {
  window_secs: number
  ok_secs: number
  degraded_secs: number
  critical_secs: number
  unknown_secs: number
  percent_ok: number
  segments: UptimeSegment[]
}

export interface HistorySample {
  status: Status
  message: string | null
  components: HealthComponent[]
  /** Unix seconds. */
  at: number
}

/** critical > unknown > degraded > ok — an absent status is treated as unknown
 *  rather than as fine, so a service we've lost track of never reads green. */
const SEVERITY: Record<string, number> = { critical: 4, unknown: 3, degraded: 2, ok: 1 }

export function severity(status: Status): number {
  if (!status) return SEVERITY.unknown
  return SEVERITY[status] ?? SEVERITY.unknown
}

export function worstOf(...statuses: Status[]): Status {
  let worst: Status = 'ok'
  for (const s of statuses) if (severity(s) > severity(worst)) worst = s
  return worst
}


/**
 * One outage: a maximal contiguous period of non-Ok *committed* (debounced)
 * status, so it is already grouped — one row per outage, not per failed poll.
 * From homelab-health v0.3.0 (`/api/v1/incidents`, and inline on each service
 * as `recent_incidents`).
 */
export interface Incident {
  monitor_id: number
  /** A display name the user can change. Join on `monitor_id` for identity. */
  monitor_name: string
  /** Unix epoch **seconds** — multiply by 1000 for `Date`. */
  started_at: number
  /** `null` means ongoing, not missing: there is deliberately no separate
   *  `resolved` flag for the two to contradict each other. */
  ended_at: number | null
  /** Counted to now while ongoing. */
  duration_secs: number
  /** Never `ok` in practice — an incident is by definition a non-Ok period. */
  worst_status: Status
  message: string | null
  /**
   * Ambiguous when empty, and treated as unknown rather than as "nothing was
   * wrong": an empty array means either the check emits no components at all
   * (`http` and `tcp` monitors never do — the rollup message is the whole
   * story) or the incident outlived the 7-day raw-sample retention and its
   * component detail was pruned. The response cannot distinguish the two, and
   * a 7-day ledger sits right on that boundary.
   */
  failing_components: IncidentComponent[]
}

export interface IncidentComponent {
  name: string
  worst_status: Status
  critical: boolean
  message: string | null
  first_seen: number
  last_seen: number
}

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
}

export interface UptimeSegment {
  status: Status
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
  at: number
}

// critical > unknown > degraded > ok
export const SEVERITY: Record<string, number> = {
  critical: 4,
  unknown: 3,
  degraded: 2,
  ok: 1,
}

export function severity(status: Status): number {
  if (!status) return 3
  return SEVERITY[status] ?? 3
}

export function worstOf(...statuses: Status[]): Status {
  let worst: Status = 'ok'
  for (const s of statuses) {
    if (severity(s) > severity(worst)) worst = s
  }
  return worst
}

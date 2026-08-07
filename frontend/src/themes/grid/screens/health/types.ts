// Data shapes describing what the integration returns live in
// integrations/health/types.ts — this file only re-exports them so the theme
// doesn't have its own drifting copy. Everything below this import is
// presentation logic (ranking and colouring a status), which is the theme's
// business and stays here.
import type {
  HealthComponent,
  HistorySample,
  Service,
  Status,
  UptimeReport,
  UptimeSegment,
} from '@/integrations/health'

export type { HealthComponent, HistorySample, Service, Status, UptimeReport, UptimeSegment }

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

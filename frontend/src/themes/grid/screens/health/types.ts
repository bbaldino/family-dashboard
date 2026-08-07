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

/**
 * `severity` and `worstOf` deliberately are NOT redefined here.
 *
 * Which status is *worse* is a fact about health data, not a rendering
 * choice — `integrations/health` owns it and its own reductions use it. What
 * belongs to this theme is `tone.ts`: which colour a status gets. Keeping a
 * second ranking here meant two places to change if the order ever did.
 */
export { severity, worstOf } from '@/integrations/health'

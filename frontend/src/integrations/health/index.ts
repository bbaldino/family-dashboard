export { healthIntegration } from './config'
export { useHealthServices, useServiceUptime, useIncidents, REFRESH_MS } from './useHealth'
export type { ServiceUptime } from './useHealth'
export { summarizeHealth } from './summary'
export type { HealthSummary } from './summary'
export { bucketSegments, BLOCKS_24H } from './uptime'
export { severity, worstOf } from './types'
export { formatDuration, formatIncidentWhen, isOngoing } from './incidents'
export type {
  Service,
  Status,
  HealthComponent,
  UptimeReport,
  UptimeSegment,
  HistorySample,
  Incident,
  IncidentComponent,
} from './types'

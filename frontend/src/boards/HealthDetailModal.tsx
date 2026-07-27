import { useQuery } from '@tanstack/react-query'
import { Modal } from '@/ui/Modal'

type Status = 'ok' | 'degraded' | 'critical' | 'unknown' | null

interface UptimeSegment {
  status: Status
  start: number
  end: number
}

interface UptimeReport {
  window_secs: number
  ok_secs: number
  degraded_secs: number
  critical_secs: number
  unknown_secs: number
  percent_ok: number
  segments: UptimeSegment[]
}

interface HistorySample {
  status: Status
  message: string | null
  components: Array<{
    name: string
    status: Status
    critical: boolean
    message: string | null
  }>
  at: number
}

interface HealthDetailModalProps {
  serviceId: number | null
  serviceName: string | null
  onClose: () => void
}

function statusColor(status: Status): string {
  switch (status) {
    case 'ok':
      return 'bg-success'
    case 'degraded':
      return 'bg-warning'
    case 'critical':
      return 'bg-error'
    default:
      return 'bg-text-muted'
  }
}

function relativeTime(unixSecs: number): string {
  const secs = Math.max(0, Math.floor(Date.now() / 1000 - unixSecs))
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

function UptimeBar({ report }: { report: UptimeReport }) {
  const total = report.window_secs
  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - total
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-xs font-medium text-text-secondary">24h uptime</div>
        <div className="text-xs text-text-primary tabular-nums">
          {report.percent_ok.toFixed(2)}%
        </div>
      </div>
      <div className="flex h-3 rounded overflow-hidden bg-bg-primary">
        {report.segments.map((seg, i) => {
          const start = Math.max(seg.start, windowStart)
          const end = Math.min(seg.end, now)
          const width = Math.max(0, ((end - start) / total) * 100)
          if (width === 0) return null
          return (
            <div
              key={i}
              className={statusColor(seg.status)}
              style={{ width: `${width}%` }}
              title={`${seg.status ?? 'unknown'} — ${relativeTime(start)} to ${relativeTime(end)}`}
            />
          )
        })}
      </div>
      <div className="mt-1 flex gap-3 text-[10px] text-text-muted">
        {report.ok_secs > 0 && <span>ok {Math.round(report.ok_secs / 60)}m</span>}
        {report.degraded_secs > 0 && <span>degraded {Math.round(report.degraded_secs / 60)}m</span>}
        {report.critical_secs > 0 && <span>critical {Math.round(report.critical_secs / 60)}m</span>}
        {report.unknown_secs > 0 && <span>unknown {Math.round(report.unknown_secs / 60)}m</span>}
      </div>
    </div>
  )
}

function HistoryList({ samples }: { samples: HistorySample[] }) {
  if (samples.length === 0) {
    return <div className="text-xs text-text-muted">No history yet.</div>
  }
  return (
    <div className="flex flex-col gap-1">
      {samples.map((s, i) => (
        <div key={i} className="flex items-baseline gap-2 text-xs">
          <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${statusColor(s.status)}`} />
          <span className="text-text-muted tabular-nums shrink-0 w-16">
            {relativeTime(s.at)}
          </span>
          <span className="text-text-primary truncate min-w-0">
            {s.message ?? (s.status ?? 'unknown')}
          </span>
        </div>
      ))}
    </div>
  )
}

export function HealthDetailModal({
  serviceId,
  serviceName,
  onClose,
}: HealthDetailModalProps) {
  const isOpen = serviceId != null

  const uptime = useQuery({
    queryKey: ['health', 'uptime', serviceId],
    queryFn: () =>
      fetch(`/api/health/uptime/${serviceId}?window=86400`).then(
        (r) => r.json() as Promise<UptimeReport>,
      ),
    enabled: isOpen,
    staleTime: 60 * 1000,
  })

  const history = useQuery({
    queryKey: ['health', 'history', serviceId],
    queryFn: () =>
      fetch(`/api/health/history/${serviceId}?limit=50`).then(
        (r) => r.json() as Promise<HistorySample[]>,
      ),
    enabled: isOpen,
    staleTime: 60 * 1000,
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={serviceName ?? 'Service'}>
      <div className="flex flex-col gap-5">
        <div>
          {uptime.isLoading ? (
            <div className="text-xs text-text-muted">Loading uptime…</div>
          ) : uptime.error || !uptime.data ? (
            <div className="text-xs text-error">Couldn't load uptime.</div>
          ) : (
            <UptimeBar report={uptime.data} />
          )}
        </div>

        <div>
          <div className="text-xs font-medium text-text-secondary mb-2">
            Recent checks
          </div>
          {history.isLoading ? (
            <div className="text-xs text-text-muted">Loading history…</div>
          ) : history.error || !history.data ? (
            <div className="text-xs text-error">Couldn't load history.</div>
          ) : (
            <HistoryList samples={history.data} />
          )}
        </div>
      </div>
    </Modal>
  )
}

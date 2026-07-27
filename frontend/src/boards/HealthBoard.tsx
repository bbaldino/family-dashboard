import { useQuery } from '@tanstack/react-query'
import { ServiceCard } from './health/ServiceCard'
import { statusTone } from './health/tone'
import { severity, type Service, type Status } from './health/types'

function SummaryCounter({ status, count }: { status: Status; count: number }) {
  const tone = statusTone(status)
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={`inline-block w-2 h-2 rounded-full ${tone.dot}`} />
      <span className="text-text-primary tabular-nums font-medium">{count}</span>
      <span className="text-text-secondary">{tone.label.toLowerCase()}</span>
    </div>
  )
}

function SummaryStrip({
  services,
  lastUpdated,
}: {
  services: Service[]
  lastUpdated: Date | null
}) {
  const counts: Record<string, number> = { ok: 0, degraded: 0, critical: 0, unknown: 0 }
  for (const s of services) {
    const k = s.status ?? 'unknown'
    counts[k] = (counts[k] ?? 0) + 1
  }
  return (
    <div className="flex items-center gap-5 px-4 py-2.5 bg-bg-card border border-border rounded-lg">
      <SummaryCounter status="ok" count={counts.ok} />
      <SummaryCounter status="degraded" count={counts.degraded} />
      <SummaryCounter status="critical" count={counts.critical} />
      <SummaryCounter status="unknown" count={counts.unknown} />
      {lastUpdated && (
        <div className="ml-auto text-xs text-text-muted">
          updated{' '}
          {lastUpdated.toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
          })}
        </div>
      )}
    </div>
  )
}

export function HealthBoard() {
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ['health', 'status'],
    queryFn: () =>
      fetch('/api/health/status').then((r) => r.json() as Promise<Service[]>),
    refetchInterval: 30 * 1000,
    staleTime: 15 * 1000,
  })

  if (isLoading && !data) {
    return (
      <div className="p-4 text-text-muted text-sm">Loading service health…</div>
    )
  }
  if (error) {
    return (
      <div className="p-4 text-error text-sm">
        Couldn't reach the health service.
      </div>
    )
  }

  const services = data ?? []
  const sorted = [...services].sort(
    (a, b) => severity(b.status) - severity(a.status),
  )
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null

  return (
    <div className="h-full overflow-auto p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-bold text-text-primary">Homelab Health</h1>
        <span className="text-xs text-text-muted">auto-refreshing every 30s</span>
      </div>
      {services.length > 0 && (
        <SummaryStrip services={services} lastUpdated={lastUpdated} />
      )}
      {services.length === 0 ? (
        <div className="text-text-muted text-sm">No services being monitored.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      )}
    </div>
  )
}

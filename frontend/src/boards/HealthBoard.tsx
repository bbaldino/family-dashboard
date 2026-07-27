import { useQuery } from '@tanstack/react-query'

type Status = 'ok' | 'degraded' | 'critical' | 'unknown' | null

interface Component {
  name: string
  status: Status
  critical: boolean
  message: string | null
}

interface Service {
  id: number
  name: string
  type_id: string
  interval_secs: number
  enabled: boolean
  status: Status
  message: string | null
  components: Component[]
  updated_at: string | null
}

// Higher = worse; agent said unknown ranks above degraded because it means "can't tell".
const SEVERITY: Record<string, number> = {
  critical: 4,
  unknown: 3,
  degraded: 2,
  ok: 1,
}

function severity(status: Status): number {
  if (!status) return 3
  return SEVERITY[status] ?? 3
}

function statusTone(status: Status): {
  dot: string
  text: string
  label: string
} {
  switch (status) {
    case 'ok':
      return { dot: 'bg-success', text: 'text-success', label: 'OK' }
    case 'degraded':
      return { dot: 'bg-warning', text: 'text-warning', label: 'Degraded' }
    case 'critical':
      return { dot: 'bg-error', text: 'text-error', label: 'Critical' }
    default:
      return {
        dot: 'bg-text-muted',
        text: 'text-text-muted',
        label: status === null ? 'Never checked' : 'Unknown',
      }
  }
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'never'
  const then = Date.parse(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
  if (Number.isNaN(then)) return iso
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

function Dot({ tone }: { tone: string }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${tone}`} />
}

function ComponentRow({ c }: { c: Component }) {
  const tone = statusTone(c.status)
  return (
    <div
      className={`flex items-baseline gap-2 text-xs ${c.critical ? '' : 'opacity-70'}`}
    >
      <Dot tone={tone.dot} />
      <span className="text-text-primary">{c.name}</span>
      {c.message && (
        <span className="text-text-muted truncate min-w-0">— {c.message}</span>
      )}
      {!c.critical && (
        <span className="text-text-muted text-[10px] uppercase tracking-wider">
          non-critical
        </span>
      )}
    </div>
  )
}

function ServiceCard({ service }: { service: Service }) {
  const tone = statusTone(service.status)
  return (
    <div className="bg-bg-card border border-border rounded-lg p-4">
      <div className="flex items-baseline gap-3 mb-1">
        <Dot tone={tone.dot} />
        <div className="text-sm font-semibold text-text-primary flex-1 truncate">
          {service.name}
        </div>
        <div className={`text-xs font-medium ${tone.text}`}>{tone.label}</div>
      </div>
      <div className="ml-[18px] flex items-center gap-2 text-xs text-text-muted">
        <span>{service.type_id}</span>
        <span>·</span>
        <span>updated {relativeTime(service.updated_at)}</span>
      </div>
      {service.message && (
        <div className="ml-[18px] mt-2 text-xs text-text-secondary">
          {service.message}
        </div>
      )}
      {service.components.length > 0 && (
        <div className="ml-[18px] mt-3 space-y-1">
          {service.components.map((c, i) => (
            <ComponentRow key={`${c.name}-${i}`} c={c} />
          ))}
        </div>
      )}
    </div>
  )
}

export function HealthBoard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['health', 'status'],
    queryFn: () => fetch('/api/health/status').then((r) => r.json() as Promise<Service[]>),
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
  if (services.length === 0) {
    return (
      <div className="p-4 text-text-muted text-sm">
        No services being monitored.
      </div>
    )
  }

  const sorted = [...services].sort(
    (a, b) => severity(b.status) - severity(a.status),
  )

  return (
    <div className="h-full overflow-auto p-4 flex flex-col gap-3">
      {sorted.map((s) => (
        <ServiceCard key={s.id} service={s} />
      ))}
    </div>
  )
}

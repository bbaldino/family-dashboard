import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { UptimeBar } from './UptimeBar'
import { statusTone } from './tone'
import type { HealthComponent, HistorySample, Service, UptimeReport } from './types'

function TypePill({ label }: { label: string }) {
  return (
    <span className="text-[10px] uppercase tracking-wider px-1.5 py-[1px] rounded bg-bg-primary text-text-muted font-medium">
      {label}
    </span>
  )
}

function CriticalPill() {
  return (
    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-[1px] rounded bg-error/15 text-error">
      CRITICAL
    </span>
  )
}

function Dot({ tone }: { tone: string }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${tone}`} />
}

function ComponentRow({ c }: { c: HealthComponent }) {
  const tone = statusTone(c.status)
  return (
    <div className="flex items-center gap-2 text-xs">
      <Dot tone={tone.dot} />
      <span className="text-text-primary font-medium">{c.name}</span>
      {c.critical && <CriticalPill />}
      {c.message && <span className="text-text-muted">{c.message}</span>}
    </div>
  )
}

function formatTimestamp(unixSecs: number): string {
  return new Date(unixSecs * 1000).toLocaleString([], {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}

function HistoryRow({ sample }: { sample: HistorySample }) {
  const tone = statusTone(sample.status)
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-text-muted tabular-nums shrink-0 min-w-[160px]">
        {formatTimestamp(sample.at)}
      </span>
      <Dot tone={tone.dot} />
      <span className="text-text-primary truncate min-w-0 flex-1">
        {sample.message ?? tone.label}
      </span>
      {sample.components.length > 0 && (
        <span className="text-[10px] uppercase tracking-wider px-1.5 py-[1px] rounded bg-bg-primary text-text-muted shrink-0">
          {sample.components.length} components
        </span>
      )}
    </div>
  )
}

export function ServiceCard({ service }: { service: Service }) {
  const [expanded, setExpanded] = useState(false)
  const tone = statusTone(service.status)

  const uptime = useQuery({
    queryKey: ['health', 'uptime', service.id],
    queryFn: () =>
      fetch(`/api/health/uptime/${service.id}?window=86400`).then(
        (r) => r.json() as Promise<UptimeReport>,
      ),
    enabled: expanded,
    staleTime: 60 * 1000,
  })

  const history = useQuery({
    queryKey: ['health', 'history', service.id],
    queryFn: () =>
      fetch(`/api/health/history/${service.id}?limit=20`).then(
        (r) => r.json() as Promise<HistorySample[]>,
      ),
    enabled: expanded,
    staleTime: 60 * 1000,
  })

  const Chevron = expanded ? ChevronDown : ChevronRight

  return (
    <div
      className={`bg-bg-card border border-border rounded-lg overflow-hidden border-l-4 ${tone.border}`}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-bg-card-hover transition-colors"
      >
        <Dot tone={tone.dot} />
        <span className="text-sm font-semibold text-text-primary">{service.name}</span>
        <TypePill label={service.type_id} />
        <span className="text-sm text-text-secondary truncate min-w-0 flex-1">
          {service.message ??
            (service.components.length > 0 && service.status === 'ok' ? 'all components ok' : '')}
        </span>
        <Chevron size={16} className="text-text-muted shrink-0" />
      </button>

      {expanded && (
        <div className="border-t border-border bg-bg-primary/40">
          {service.components.length > 0 && (
            <div className="px-4 py-3 space-y-1.5">
              {service.components.map((c, i) => (
                <ComponentRow key={`${c.name}-${i}`} c={c} />
              ))}
            </div>
          )}

          <div className="px-4 py-3 border-t border-border">
            <div className="flex items-baseline justify-between mb-2">
              <div className="text-xs font-semibold text-text-primary">
                {uptime.data ? `${uptime.data.percent_ok.toFixed(1)}% uptime` : 'Uptime'}
              </div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider">24h</div>
            </div>
            {uptime.isLoading ? (
              <div className="text-xs text-text-muted">Loading uptime…</div>
            ) : uptime.error || !uptime.data ? (
              <div className="text-xs text-error">Couldn't load uptime.</div>
            ) : (
              <UptimeBar report={uptime.data} />
            )}
          </div>

          <div className="px-4 py-3 border-t border-border">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
              History
            </div>
            {history.isLoading ? (
              <div className="text-xs text-text-muted">Loading history…</div>
            ) : history.error || !history.data ? (
              <div className="text-xs text-error">Couldn't load history.</div>
            ) : history.data.length === 0 ? (
              <div className="text-xs text-text-muted">No history yet.</div>
            ) : (
              <div className="space-y-1">
                {history.data.map((s, i) => (
                  <HistoryRow key={i} sample={s} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

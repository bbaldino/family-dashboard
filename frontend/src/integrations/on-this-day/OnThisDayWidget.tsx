import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { WidgetCard } from '@/ui/WidgetCard'
import { useOnThisDay } from './useOnThisDay'
import type { OnThisDayBirth } from './useOnThisDay'
import { useIntegrationConfig } from '@/integrations/use-integration-config'
import { onThisDayIntegration } from './config'

type WidgetSize = 'compact' | 'standard' | 'expanded'

interface OnThisDayWidgetProps {
  size?: WidgetSize
}

function BirthsFooter({ births }: { births: OnThisDayBirth[] }) {
  if (births.length === 0) return null

  return (
    <div className="mt-auto pt-2 border-t border-border">
      <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.3px] mb-1">
        Also Born Today
      </div>
      <div className="flex flex-col gap-1">
        {births.map((b, i) => (
          <div key={i} className="flex items-center gap-2 text-[12px]">
            {b.photoUrl && (
              <img
                src={b.photoUrl}
                alt={b.name}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-text-primary truncate">{b.name}</div>
              <div className="text-text-muted text-[10px] truncate">
                {b.knownFor.length > 0 ? b.knownFor.join(', ') : b.role}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function OnThisDayWidget({ size = 'standard' }: OnThisDayWidgetProps) {
  const { data, isLoading } = useOnThisDay()
  const config = useIntegrationConfig(onThisDayIntegration)
  const [index, setIndex] = useState(0)
  const [cycleKey, setCycleKey] = useState(0)

  const events = data?.events ?? []
  const births = data?.births ?? []
  const cycleMs = (parseInt(config?.cycle_minutes ?? '30', 10) || 30) * 60 * 1000

  // Auto-cycle timer — resets when cycleKey changes (manual advance)
  useEffect(() => {
    if (events.length <= 1) return
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % events.length)
    }, cycleMs)
    return () => clearInterval(timer)
  }, [events.length, cycleKey, cycleMs])

  const advance = useCallback(() => {
    if (events.length > 0) {
      setIndex((prev) => (prev + 1) % events.length)
      setCycleKey((prev) => prev + 1) // Reset auto-cycle timer
    }
  }, [events.length])

  if (isLoading || events.length === 0) {
    return (
      <WidgetCard title="On This Day" category="info">
        <div className="text-text-muted text-sm">
          {isLoading ? 'Loading...' : 'No events today'}
        </div>
      </WidgetCard>
    )
  }

  const event = events[index % events.length]

  if (size === 'compact') {
    return (
      <WidgetCard
        title="On This Day"
        category="info"
        detail={
          <div className="flex flex-col gap-2">
            {event.year && (
              <div className="text-4xl font-extrabold text-palette-3 leading-none tracking-tight">
                {event.year}
              </div>
            )}
            <p className="text-text-primary text-sm leading-relaxed">{event.text}</p>
            <BirthsFooter births={births} />
          </div>
        }
      >
        <div className="flex flex-col gap-1">
          {event.year && (
            <div className="text-xl font-extrabold text-palette-3 leading-none">{event.year}</div>
          )}
          <p className="text-text-primary text-xs leading-snug line-clamp-2">{event.text}</p>
        </div>
      </WidgetCard>
    )
  }

  // Standard
  return (
    <WidgetCard title="On This Day" category="info">
      <div className="flex flex-col gap-2 h-full">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {event.year && (
              <div className="text-4xl font-extrabold text-palette-3 leading-none tracking-tight">
                {event.year}
              </div>
            )}
            <p className="text-text-primary text-sm leading-relaxed mt-2">{event.text}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              advance()
            }}
            className="p-1.5 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-primary transition-colors flex-shrink-0"
          >
            <RefreshCw size={14} />
          </button>
        </div>
        <BirthsFooter births={births} />
      </div>
    </WidgetCard>
  )
}

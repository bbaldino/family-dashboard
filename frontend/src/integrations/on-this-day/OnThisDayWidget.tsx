import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { WidgetCard } from '@/ui/WidgetCard'
import { useOnThisDay } from './useOnThisDay'
import { useIntegrationConfig } from '@/integrations/use-integration-config'
import { onThisDayIntegration } from './config'

type WidgetSize = 'compact' | 'standard' | 'expanded'

interface OnThisDayWidgetProps {
  size?: WidgetSize
}

export function OnThisDayWidget({ size = 'standard' }: OnThisDayWidgetProps) {
  const { data, isLoading } = useOnThisDay()
  const config = useIntegrationConfig(onThisDayIntegration)
  const [index, setIndex] = useState(0)
  const [cycleKey, setCycleKey] = useState(0)

  const events = data?.events ?? []
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
      <div className="flex flex-col h-full" style={{ gap: '2cqi' }}>
        <div className="flex items-start justify-between" style={{ gap: '2cqi' }}>
          <div className="flex-1 min-w-0">
            {event.year && (
              <div className="font-extrabold text-palette-3 leading-none tracking-tight" style={{ fontSize: '7cqi' }}>
                {event.year}
              </div>
            )}
            <div className="flex" style={{ gap: '2cqi', marginTop: '1.5cqi' }}>
              <p className="text-text-primary leading-relaxed flex-1" style={{ fontSize: '3cqi' }}>{event.text}</p>
              {event.imageUrl && (
                <img
                  src={event.imageUrl}
                  alt=""
                  className="rounded object-cover flex-shrink-0"
                  style={{ width: '20cqi', height: '20cqi' }}
                />
              )}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              advance()
            }}
            className="rounded-full text-text-muted hover:text-text-primary hover:bg-bg-primary transition-colors flex-shrink-0"
            style={{ padding: '1.5cqi' }}
          >
            <RefreshCw style={{ width: '3cqi', height: '3cqi' }} />
          </button>
        </div>
      </div>
    </WidgetCard>
  )
}

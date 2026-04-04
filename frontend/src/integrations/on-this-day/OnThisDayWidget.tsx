import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { WidgetCard } from '@/ui/WidgetCard'
import type { WidgetSize } from '@/lib/widget-types'
import { useOnThisDay } from './useOnThisDay'
import type { OnThisDayBirth } from './useOnThisDay'

interface OnThisDayWidgetProps {
  size?: WidgetSize
}

const CYCLE_INTERVAL_MS = 30_000

function BirthsFooter({ births }: { births: OnThisDayBirth[] }) {
  if (births.length === 0) return null

  return (
    <div className="mt-auto pt-2 border-t border-border">
      <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.3px] mb-1">
        Also Born Today
      </div>
      <div className="flex flex-col gap-0.5">
        {births.map((b, i) => (
          <div key={i} className="flex justify-between text-[12px]">
            <span className="text-text-primary truncate mr-2">{b.name}</span>
            <span className="text-text-muted whitespace-nowrap">
              {b.year} · {b.role}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function OnThisDayWidget({ size = 'standard' }: OnThisDayWidgetProps) {
  const { data, isLoading } = useOnThisDay()
  const [index, setIndex] = useState(0)
  const [cycleKey, setCycleKey] = useState(0)

  const events = data?.events ?? []
  const births = data?.births ?? []

  // Auto-cycle timer — resets when cycleKey changes (manual advance)
  useEffect(() => {
    if (events.length <= 1) return
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % events.length)
    }, CYCLE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [events.length, cycleKey])

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

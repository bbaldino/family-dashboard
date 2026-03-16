import { useState, useEffect } from 'react'
import { Settings } from 'lucide-react'

interface HeroEvent {
  name: string
  time: string
  detail?: string
}

interface HeroStripProps {
  events?: HeroEvent[]
  weatherTemp?: string
  weatherCondition?: string
  weatherIcon?: string
  onWeatherClick?: () => void
  onSettingsClick?: () => void
}

export function HeroStrip({ events = [], weatherTemp, weatherCondition, weatherIcon = '\u2601', onWeatherClick, onSettingsClick }: HeroStripProps) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
  const hasEvents = events.length > 0
  const label = hasEvents ? 'Right Now' : 'Next Up'

  return (
    <div className="bg-bg-card rounded-[var(--radius-card)] shadow-[var(--shadow-card)] flex items-center gap-5 px-7 py-3">
      <div>
        <div className="text-[52px] font-extralight tracking-[-2px] leading-none text-text-primary">{time}</div>
        <div className="text-[15px] text-text-secondary mt-[2px]">{date}</div>
      </div>
      <div className="w-px h-12 bg-separator flex-shrink-0" />
      <div className="flex-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.5px] text-calendar mb-1">{label}</div>
        {events.length === 0 ? (
          <div className="text-[14px] text-text-muted">No upcoming events</div>
        ) : (
          <div className="flex gap-3">
            {events.slice(0, 2).map((event, i) => (
              <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pl-3 border-l border-separator' : ''}`}>
                <div>
                  <div className="text-[16px] font-medium text-text-primary">{event.name}</div>
                  {event.detail && <div className="text-[11px] text-text-muted">{event.detail}</div>}
                </div>
                <div className="text-[13px] font-semibold text-calendar whitespace-nowrap">{event.time}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="w-px h-12 bg-separator flex-shrink-0" />
      <div
        className={`flex items-center gap-[10px] ${onWeatherClick ? 'cursor-pointer active:opacity-70 transition-opacity rounded-xl px-2 py-1 -mx-2 -my-1' : ''}`}
        onClick={onWeatherClick}
      >
        <span className="text-[30px]">{weatherIcon}</span>
        <div>
          <div className="text-[30px] font-light leading-none text-text-primary">{weatherTemp || '--'}&deg;</div>
          <div className="text-[12px] text-text-secondary">{weatherCondition || ''}</div>
        </div>
      </div>
      {onSettingsClick && (
        <>
          <div className="w-px h-12 bg-separator flex-shrink-0" />
          <button
            onClick={onSettingsClick}
            className="p-2 rounded-[var(--radius-button)] text-text-muted hover:text-text-secondary hover:bg-bg-card-hover transition-colors"
          >
            <Settings size={20} />
          </button>
        </>
      )}
    </div>
  )
}

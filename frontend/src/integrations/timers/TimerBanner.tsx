import { useState, useEffect } from 'react'
import { useTimers } from './useTimers'
import { TimerCard } from './TimerCard'

export function TimerBanner() {
  const [serviceUrl, setServiceUrl] = useState<string | undefined>(undefined)
  const [alarmSoundId, setAlarmSoundId] = useState<string | undefined>(undefined)

  // Load config
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((config: Record<string, string>) => {
        const url = config['timers.service_url']
        if (url) setServiceUrl(url)
        setAlarmSoundId(config['timers.alarm_sound'])
      })
      .catch(() => {})
  }, [])

  const { timers, firedTimers, pause, resume, cancel, dismiss } = useTimers(serviceUrl, alarmSoundId)

  const hasContent = timers.length > 0 || firedTimers.length > 0
  if (!hasContent) return null

  return (
    <div className="space-y-2">
      {/* Fired timer alerts */}
      {firedTimers.map((timer) => (
        <div
          key={timer.id}
          className="flex items-center gap-3 px-5 py-3 rounded-[var(--radius-card)] shadow-[var(--shadow-card)]"
          style={{ background: 'linear-gradient(135deg, #e53935 0%, #ef5350 100%)' }}
        >
          <span className="text-[22px]">🔔</span>
          <div className="flex-1">
            <div className="text-[14px] font-bold text-white">{timer.name} timer is done!</div>
            <div className="text-[10px] text-white/70">
              {Math.round(timer.durationMs / 60000)} minutes · completed
            </div>
          </div>
          <button
            onClick={() => dismiss(timer.id)}
            className="px-4 py-1.5 rounded-md bg-white/20 hover:bg-white/30 text-white text-[11px] font-semibold"
          >
            Dismiss
          </button>
        </div>
      ))}

      {/* Active timers banner */}
      {timers.length > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-2 rounded-[var(--radius-card)] shadow-[var(--shadow-card)]"
          style={{ background: 'linear-gradient(135deg, var(--color-palette-1) 0%, #d4784a 100%)' }}
        >
          {timers.map((timer, i) => (
            <div key={timer.id} className="flex items-center gap-3">
              {i > 0 && <div className="w-px h-8 bg-white/15" />}
              <TimerCard
                timer={timer}
                onPause={() => pause(timer.id)}
                onResume={() => resume(timer.id)}
                onCancel={() => cancel(timer.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

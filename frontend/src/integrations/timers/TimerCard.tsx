import type { Timer } from './types'

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}:${String(mins).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

interface TimerCardProps {
  timer: Timer
  onPause: () => void
  onResume: () => void
  onCancel: () => void
}

export function TimerCard({ timer, onPause, onResume, onCancel }: TimerCardProps) {
  const isPaused = timer.status === 'paused'

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.12)]">
      <span className="text-[18px]">⏲️</span>
      <div>
        <div className="text-[22px] font-bold tabular-nums leading-none text-white">
          }`}
        >
          {formatCountdown(timer.remainingMs)}
        </div>
        <div className="text-[10px] text-white/75">
          {timer.name}
          {isPaused && <span className="ml-1 text-white/50">PAUSED</span>}
        </div>
      </div>
      <div className="flex gap-1 ml-2">
        {isPaused ? (
          <button
            onClick={onResume}
            className="w-7 h-7 rounded-md bg-white/20 hover:bg-white/30 text-white text-[12px] flex items-center justify-center"
            title="Resume"
          >
            ▶
          </button>
        ) : (
          <button
            onClick={onPause}
            className="w-7 h-7 rounded-md bg-white/20 hover:bg-white/30 text-white text-[12px] flex items-center justify-center"
            title="Pause"
          >
            ⏸
          </button>
        )}
        <button
          onClick={onCancel}
          className="w-7 h-7 rounded-md bg-white/20 hover:bg-white/30 text-white text-[12px] flex items-center justify-center"
          title="Cancel"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

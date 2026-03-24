import { Music, Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react'
import { useMusic } from '@/integrations/music'

interface NowPlayingProps {
  onOpenFullscreen: () => void
  onOpenPlayerPicker: () => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function NowPlaying({ onOpenFullscreen, onOpenPlayerPicker }: NowPlayingProps) {
  const { state, pause, resume, next, previous, setVolume } = useMusic()
  const { activeQueue } = state

  if (!activeQueue || !activeQueue.currentItem) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-text-secondary">
        <Music size={48} />
        <span className="text-base font-medium">Nothing playing</span>
        <span className="text-sm">Pick something from the left</span>
      </div>
    )
  }

  const { currentItem, displayName, volumeLevel, queueId } = activeQueue
  const isPlaying = activeQueue.state === 'playing'

  const elapsed = currentItem.elapsed ?? 0
  const duration = currentItem.duration ?? 0
  const progressPercent = duration > 0 ? Math.min((elapsed / duration) * 100, 100) : 0

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(queueId, Number(e.target.value))
  }

  return (
    <div className="flex flex-col items-center gap-5 py-6 px-4 h-full">
      {/* Cover art */}
      <button
        onClick={onOpenFullscreen}
        className="flex-shrink-0 w-[200px] h-[200px] rounded-lg shadow-lg overflow-hidden bg-bg-card flex items-center justify-center"
      >
        {currentItem.imageUrl ? (
          <img
            src={currentItem.imageUrl}
            alt={currentItem.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Music size={64} className="text-text-secondary" />
        )}
      </button>

      {/* Track info */}
      <div className="text-center w-full">
        <div className="text-xl font-bold text-text-primary truncate">{currentItem.name}</div>
        <div className="text-text-secondary text-sm mt-1 truncate">
          {currentItem.artist}
          {currentItem.album ? ` · ${currentItem.album}` : ''}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full">
        <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-text-secondary mt-1">
          <span>{formatTime(elapsed)}</span>
          <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
        </div>
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => previous()}
          className="w-10 h-10 flex items-center justify-center text-text-secondary"
        >
          <SkipBack size={24} />
        </button>
        <button
          onClick={() => (isPlaying ? pause() : resume())}
          className="w-[52px] h-[52px] rounded-full bg-accent flex items-center justify-center text-white"
        >
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
        </button>
        <button
          onClick={() => next()}
          className="w-10 h-10 flex items-center justify-center text-text-secondary"
        >
          <SkipForward size={24} />
        </button>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-3 w-full">
        <Volume2 size={16} className="text-text-secondary flex-shrink-0" />
        <input
          type="range"
          min={0}
          max={100}
          value={volumeLevel ?? 0}
          onChange={handleVolumeChange}
          className="flex-1"
        />
      </div>

      {/* Player picker pill */}
      <button
        onClick={onOpenPlayerPicker}
        className="px-4 py-1.5 rounded-full bg-bg-card border border-border text-sm text-text-secondary"
      >
        {displayName}
      </button>
    </div>
  )
}

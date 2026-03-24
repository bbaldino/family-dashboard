import { useNavigate } from 'react-router-dom'
import { Music, Play, Pause, SkipBack, SkipForward, Volume2, X } from 'lucide-react'
import { useMusic } from './useMusic'

export function MiniPlayer() {
  const { state, isPlaying, pause, resume, stop, next, previous, setVolume } = useMusic()
  const navigate = useNavigate()

  const { activeQueue } = state

  if (!activeQueue) return null

  const { currentItem, displayName, volumeLevel, queueId } = activeQueue

  const handleCoverOrTitleClick = () => {
    navigate('/media')
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(queueId, Number(e.target.value))
  }

  return (
    <div className="flex items-center gap-4 px-6 py-2 bg-bg-card border-t border-border">
      {/* Cover art */}
      <button
        onClick={handleCoverOrTitleClick}
        className="flex-shrink-0 w-11 h-11 rounded overflow-hidden bg-bg-primary flex items-center justify-center"
      >
        {currentItem?.imageUrl ? (
          <img
            src={currentItem.imageUrl}
            alt={currentItem.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Music size={20} className="text-text-secondary" />
        )}
      </button>

      {/* Track info */}
      <button
        onClick={handleCoverOrTitleClick}
        className="flex-1 min-w-0 text-left"
      >
        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-text-primary text-sm font-medium">
          {currentItem?.name ?? '—'}
        </div>
        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-text-secondary text-xs">
          {currentItem?.artist ?? ''}
        </div>
      </button>

      {/* Playback controls */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => previous()}
          className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary"
        >
          <SkipBack size={16} />
        </button>
        <button
          onClick={() => (isPlaying ? pause() : resume())}
          className="w-10 h-10 rounded-full flex items-center justify-center text-palette-1"
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button
          onClick={() => next()}
          className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary"
        >
          <SkipForward size={16} />
        </button>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Volume2 size={16} className="text-text-secondary" />
        <input
          type="range"
          min={0}
          max={100}
          value={volumeLevel ?? 0}
          onChange={handleVolumeChange}
          className="w-20"
        />
      </div>

      {/* Player name pill */}
      <span className="flex-shrink-0 text-xs text-text-secondary bg-bg-primary px-2 py-0.5 rounded-full">
        {displayName}
      </span>

      {/* Stop / dismiss */}
      <button
        onClick={() => stop()}
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary"
      >
        <X size={14} />
      </button>
    </div>
  )
}

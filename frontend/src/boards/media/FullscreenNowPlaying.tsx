import { useEffect } from 'react'
import { Music, Play, Pause, SkipBack, SkipForward, X } from 'lucide-react'
import { useMusic } from '@/integrations/music'

interface FullscreenNowPlayingProps {
  isOpen: boolean
  onClose: () => void
}

export function FullscreenNowPlaying({ isOpen, onClose }: FullscreenNowPlayingProps) {
  const { state, pause, resume, next, previous } = useMusic()
  const { activeQueue } = state

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const currentItem = activeQueue?.currentItem ?? null
  const isPlaying = activeQueue?.state === 'playing'

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      {/* Dismiss button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-white/70 hover:text-white"
        aria-label="Close"
      >
        <X size={28} />
      </button>

      {/* Content — stop propagation so tapping the content area itself doesn't dismiss */}
      <div
        className="flex flex-col items-center gap-6 px-8 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cover art */}
        <div className="w-full" style={{ maxHeight: '60vh' }}>
          {currentItem?.imageUrl ? (
            <img
              src={currentItem.imageUrl}
              alt={currentItem.name}
              className="w-full object-contain rounded-2xl shadow-2xl"
              style={{ maxHeight: '60vh' }}
            />
          ) : (
            <div
              className="w-full rounded-2xl shadow-2xl bg-white/10 flex items-center justify-center"
              style={{ aspectRatio: '1 / 1', maxHeight: '60vh' }}
            >
              <Music size={96} className="text-white/40" />
            </div>
          )}
        </div>

        {/* Track info */}
        <div className="text-center w-full">
          <div className="text-2xl font-bold text-white truncate">
            {currentItem?.name ?? 'Nothing playing'}
          </div>
          {currentItem?.artist && (
            <div className="text-white/70 text-base mt-1 truncate">
              {currentItem.artist}
              {currentItem.album ? ` · ${currentItem.album}` : ''}
            </div>
          )}
        </div>

        {/* Playback controls */}
        <div className="flex items-center gap-10">
          <button
            onClick={() => previous()}
            className="w-14 h-14 flex items-center justify-center text-white/80 hover:text-white"
            aria-label="Previous"
          >
            <SkipBack size={36} />
          </button>
          <button
            onClick={() => (isPlaying ? pause() : resume())}
            className="w-20 h-20 rounded-full bg-white flex items-center justify-center text-black"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={36} /> : <Play size={36} />}
          </button>
          <button
            onClick={() => next()}
            className="w-14 h-14 flex items-center justify-center text-white/80 hover:text-white"
            aria-label="Next"
          >
            <SkipForward size={36} />
          </button>
        </div>
      </div>
    </div>
  )
}

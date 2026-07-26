import { useEffect, useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'

export interface TrackLike {
  uri: string
  media_type: string
  name: string
  artist?: string
  artist_uri?: string | null
  album?: string | null
  album_uri?: string | null
  image_url?: string | null
}

export interface TrackActionsMenuProps {
  item: TrackLike
  onPlayRadio: () => void
  onPlayJustThis: () => void
  onPlayNext: () => void
  onAddToQueue: () => void
  onGoToArtist: () => void
  onGoToAlbum: () => void
}

interface Action {
  label: string
  onClick: () => void
  divider?: boolean
}

export function TrackActionsMenu({
  item,
  onPlayRadio,
  onPlayJustThis,
  onPlayNext,
  onAddToQueue,
  onGoToArtist,
  onGoToAlbum,
}: TrackActionsMenuProps): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('click', handler, { capture: true })
    return () => document.removeEventListener('click', handler, { capture: true })
  }, [open])

  const isTrack = item.media_type === 'track'
  const actions: Action[] = []

  if (isTrack) {
    actions.push(
      { label: 'Play radio from this', onClick: onPlayRadio },
      { label: 'Play just this track', onClick: onPlayJustThis },
      { label: 'Play next', onClick: onPlayNext },
      { label: 'Add to queue', onClick: onAddToQueue },
    )
  }
  const hasNavActions = Boolean(item.artist_uri || item.album_uri)
  if (isTrack && hasNavActions) {
    actions.push({ label: '__divider__', onClick: () => {}, divider: true })
  }
  if (item.artist_uri) {
    actions.push({ label: 'Go to artist', onClick: onGoToArtist })
  }
  if (item.album_uri) {
    actions.push({ label: 'Go to album', onClick: onGoToAlbum })
  }

  if (actions.length === 0) return null

  const run = (cb: () => void) => {
    setOpen(false)
    cb()
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="p-1.5 rounded text-text-secondary hover:bg-bg-primary hover:text-text-primary"
        aria-label="More play options"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-10 bg-bg-card border border-border rounded-lg shadow-lg overflow-hidden min-w-[180px]">
          {actions.map((a, i) =>
            a.divider ? (
              <div key={`d${i}`} className="border-t border-border" />
            ) : (
              <button
                key={a.label}
                onClick={() => run(a.onClick)}
                className="block w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-primary"
              >
                {a.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}

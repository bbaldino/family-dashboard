import { useEffect } from 'react'
import { useMusic } from '@/integrations/music'
import { CentreSpreadMasthead } from './CentreSpreadMasthead'
import { CentreSpreadCredits } from './CentreSpreadCredits'
import { CentreSpreadPlate } from './CentreSpreadPlate'
import { CentreSpreadRunningOrder } from './CentreSpreadRunningOrder'

/**
 * The Centre Spread — broadsheet's full-page now-playing view, reached by
 * tapping the cover in the Media screen's Now Spinning rail
 * (`NowSpinning.tsx`'s `onOpenCentreSpread`). Mock: `docs/superpowers/designs/broadsheet/nowplaying.jsx`.
 *
 * `Media.tsx` owns whether this renders at all as local state — the same
 * way grid's `MediaBoard` holds its own `fullscreen` boolean (read for the
 * pattern only; nothing imported from grid). This is deliberately not a
 * `ScreenKey`: that would be a shell contract change reaching both themes
 * for something only broadsheet has. The accepted consequence is that this
 * view isn't linkable and doesn't survive a reload — the right trade for a
 * wall tablet you tap, per the design brief.
 *
 * Layout is flex-column, not the mock's `position: absolute; top: 152`
 * (`nowplaying.jsx:76`) — the same deviation `Media.tsx`'s own header
 * comment explains for its body: a hard-coded offset would have to assume
 * this masthead always renders at exactly 152px tall, where letting
 * flexbox size the body is correct regardless of font-metric drift.
 *
 * Unlike `Media.tsx`, this doesn't render the theme's `Footer` itself —
 * `BroadsheetLayout` already renders it, pinned absolutely on top of
 * whatever `Outlet` shows, on every screen including this one. The trailing
 * 64px spacer below just reserves its height from this column's own flow,
 * the same way `Media.tsx`'s does.
 */
export function CentreSpread({ onClose }: { onClose: () => void }) {
  const { state, isPlaying, pause, resume, next, previous, setVolume } = useMusic()
  const activeQueue = state.activeQueue
  const currentItem = activeQueue?.currentItem ?? null

  // If the track playing when this page opened stops — playback ends, the
  // queue is stopped from another room's control, Music Assistant drops the
  // connection — there's nothing left for a now-playing page to show: no
  // sleeve, no credits, no running order. Rather than invent placeholder
  // content the design brief explicitly rules out, or leave a page-sized
  // hole, this falls back to Media's own body, which already has a written
  // "nothing playing" state for exactly this condition (`NowSpinning`'s
  // "Nothing on the platter."). This also covers cold start: every hook can
  // be empty on first paint, and an empty `currentItem` here just closes
  // immediately rather than rendering broken.
  useEffect(() => {
    if (!currentItem) onClose()
  }, [currentItem, onClose])

  if (!currentItem || !activeQueue) return null

  return (
    <div
      data-testid="broadsheet-centre-spread"
      className="broadsheet-root w-[1600px] h-[900px] flex flex-col"
    >
      <CentreSpreadMasthead
        trackTitle={currentItem.name}
        trackNumber={currentItem.trackNumber ?? null}
        onClose={onClose}
      />
      <div
        data-testid="broadsheet-centre-spread-body"
        className="flex-1 min-h-0 grid"
        style={{ gridTemplateColumns: '300px 1fr 340px' }}
      >
        <CentreSpreadCredits
          track={currentItem}
          activeQueue={activeQueue}
          onSetVolume={setVolume}
        />
        <div
          className="min-h-0"
          style={{ borderLeft: '1px solid var(--rule)', borderRight: '1px solid var(--rule)' }}
        >
          <CentreSpreadPlate
            track={currentItem}
            isPlaying={isPlaying}
            onPause={pause}
            onResume={resume}
            onNext={next}
            onPrevious={previous}
          />
        </div>
        <CentreSpreadRunningOrder
          queueId={activeQueue.queueId}
          current={{ title: currentItem.name, artist: currentItem.artist, uri: currentItem.uri }}
        />
      </div>
      {/* Reserves the 64px `Footer` occupies, pinned by `BroadsheetLayout` —
       *  same spacer `Media.tsx` ends with, and the same reason. */}
      <div style={{ flexShrink: 0, height: 64 }} />
    </div>
  )
}

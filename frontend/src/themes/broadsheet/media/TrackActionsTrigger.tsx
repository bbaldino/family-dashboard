import { TrackActionsMenu } from './TrackActionsMenu'
import type { TrackActionsMenuGroup } from './TrackActionsMenu'

/**
 * The `⋮` trigger and its menu, together — the one cell `AlbumTrackRow.tsx`
 * and `ArtistTrackRow.tsx` both need, factored out because the two rows are
 * otherwise different shapes (the album row has no cover; the artist row
 * has no track number) but this cell is identical in both. Per the design
 * brief: closed, the glyph is muted; open, it "turns rust and bold" and its
 * row (the caller's job — see `TrackActionsMenu.tsx`'s header comment) gets
 * the deeper-paper/rust-bar highlight.
 *
 * Rendering the menu here rather than in the row itself keeps the "which
 * six actions, wired to what" question in one place per page instead of
 * duplicated between the trigger and the row that owns it.
 */
export function TrackActionsTrigger({
  isOpen,
  onToggle,
  kicker,
  title,
  groups,
}: {
  isOpen: boolean
  onToggle: () => void
  kicker: string
  title: string
  groups: TrackActionsMenuGroup[]
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Track actions"
        onClick={(event) => {
          event.stopPropagation()
          onToggle()
        }}
        style={{
          all: 'unset',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          lineHeight: 1,
          textAlign: 'right',
          color: isOpen ? 'var(--rust)' : 'var(--ink-muted)',
          fontWeight: isOpen ? 700 : 400,
        }}
      >
        ⋮
      </button>
      {isOpen && <TrackActionsMenu kicker={kicker} title={title} groups={groups} />}
    </>
  )
}

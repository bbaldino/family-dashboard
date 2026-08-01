import { CARD_BG } from './colors'

export interface TrackActionsMenuItem {
  label: string
  onSelect: () => void
}

export interface TrackActionsMenuGroup {
  label: string
  items: TrackActionsMenuItem[]
}

/**
 * The track actions menu — an "index card", not a rounded popover: a 268px
 * paper panel with a 1px ink border and a hard offset shadow, per the
 * design brief. `Album.tsx` and `Artist.tsx` are both callers; this
 * component only renders the card itself — positioning it against its
 * triggering row, dimming the page behind it, and highlighting that row are
 * all the caller's job (see `AlbumTrackRow.tsx`'s own header comment for
 * why: this card doesn't know where on the page it's being anchored, and a
 * page-spanning scrim can't be sized correctly from inside a single row's
 * own `position: relative` box).
 *
 * `groups` with an empty `items` array are skipped entirely — the header
 * comment on the row rather than this card decides when a group like "Go
 * to" has nothing to navigate to (a track missing an `artist_uri`, say);
 * this card just doesn't draw a heading with nothing under it.
 *
 * The first item of the first non-empty group gets the mock's highlight
 * treatment — rust text, weight 600, a faint rust wash — marking it the
 * default action (mock: `music-pages.jsx:280-323`).
 */
export function TrackActionsMenu({
  kicker,
  title,
  groups,
}: {
  /** The header's small mono line — e.g. `Track 01` for an album's running
   *  order, or just `Track` where there's no meaningful position to number
   *  (`Artist.tsx`'s most-played list isn't an album running order). */
  kicker: string
  title: string
  groups: TrackActionsMenuGroup[]
}) {
  const visibleGroups = groups.filter((g) => g.items.length > 0)
  if (visibleGroups.length === 0) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        width: 268,
        zIndex: 40,
        background: 'var(--paper)',
        border: '1px solid var(--ink)',
        boxShadow: '10px 10px 0 rgba(25,21,18,0.16)',
      }}
    >
      <div style={{ padding: '8px 14px', borderBottom: '2px solid var(--ink)', background: CARD_BG }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>
          {kicker}
        </div>
        <div className="truncate" style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, lineHeight: 1.15, marginTop: 1 }}>
          {title}
        </div>
      </div>
      {visibleGroups.map((group, gi) => (
        <div key={group.label} style={{ borderTop: gi === 0 ? 'none' : '1px solid var(--ink)' }}>
          <div
            style={{
              padding: '6px 14px 2px',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--ink-muted)',
            }}
          >
            {group.label}
          </div>
          <ul className="m-0 p-0" style={{ listStyle: 'none' }}>
            {group.items.map((item, i) => {
              const isDefault = gi === 0 && i === 0
              return (
                <li key={item.label} style={{ borderTop: i === 0 ? 'none' : '1px dotted var(--rule)' }}>
                  <button
                    type="button"
                    onClick={item.onSelect}
                    className="block w-full text-left"
                    style={{
                      all: 'unset',
                      display: 'block',
                      width: '100%',
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                      padding: '7px 14px',
                      fontFamily: 'var(--font-display)',
                      fontSize: 15,
                      color: isDefault ? 'var(--rust)' : 'var(--ink)',
                      fontWeight: isDefault ? 600 : 400,
                      background: isDefault ? 'rgba(180,58,26,0.06)' : 'transparent',
                    }}
                  >
                    {item.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

import { useCallback, useState } from 'react'
import { CARD_BG } from './colors'
import { visibleClipRect } from './visible-clip-rect'

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
 *
 * Opens downward (`top: 100%`) by default, matching the mock, but flips to
 * open upward (`bottom: 100%`) when it wouldn't fit below — measured live
 * against a fully packed Quick Dials shelf (`?scenario=packed`, all six
 * rows), where a bottom-row card's menu opened downward ran well past both
 * `Media.tsx`'s own shelf column (`overflow: hidden`, sized only for its
 * capped rows) and the page canvas beneath it, clipped invisible either
 * way. `visibleClipRect` finds the nearest ancestor that would actually do
 * that clipping — measured from a callback ref rather than a `useLayoutEffect`
 * (both run before the browser paints, so neither causes a visible jump,
 * but a ref callback calling `setState` during commit is the idiomatic
 * React way to do this; an effect body doing the same is a lint-flagged
 * anti-pattern — `react-hooks/set-state-in-effect`). `useCallback` with no
 * dependencies keeps the ref's identity stable across re-renders, so React
 * only invokes it on mount and unmount, not on every render — this only
 * ever needs to measure once, since a menu is a fresh mount every time it
 * opens (`TrackActionsTrigger`'s own `{isOpen && ...}`).
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
  const [openUpward, setOpenUpward] = useState(false)

  const measureRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    const clip = visibleClipRect(el)
    if (clip && el.getBoundingClientRect().bottom > clip.bottom) {
      setOpenUpward(true)
    }
  }, [])

  if (visibleGroups.length === 0) return null

  return (
    <div
      ref={measureRef}
      data-testid="broadsheet-track-actions-menu"
      style={{
        position: 'absolute',
        ...(openUpward ? { bottom: '100%' } : { top: '100%' }),
        right: 0,
        width: 268,
        zIndex: 40,
        background: 'var(--paper)',
        border: '1px solid var(--ink)',
        boxShadow: '10px 10px 0 rgba(25,21,18,0.16)',
      }}
    >
      <div
        style={{ padding: '8px 14px', borderBottom: '2px solid var(--ink)', background: CARD_BG }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--ink-muted)',
          }}
        >
          {kicker}
        </div>
        <div
          className="truncate"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            fontWeight: 600,
            lineHeight: 1.15,
            marginTop: 1,
          }}
        >
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
                <li
                  key={item.label}
                  style={{ borderTop: i === 0 ? 'none' : '1px dotted var(--rule)' }}
                >
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

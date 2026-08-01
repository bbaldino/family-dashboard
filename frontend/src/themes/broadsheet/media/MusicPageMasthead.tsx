import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { MastheadFrame } from '@/themes/broadsheet/ui/MastheadFrame'
import { mastheadKickerStyle } from '@/themes/broadsheet/ui/masthead-styles'

const backButtonStyle = {
  all: 'unset' as const,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 14px',
  border: '1px solid var(--ink)',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.22em',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  color: 'var(--ink)',
  marginBottom: 4,
}

const actionButtonStyle = {
  all: 'unset' as const,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '9px 18px',
  background: 'var(--rust)',
  color: 'var(--paper)',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.22em',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  marginBottom: 4,
}

/**
 * The masthead shared by The Record and The Profile — the same
 * `MastheadFrame` every broadsheet screen uses, with the layout the design
 * brief specifies for both of these two: a bordered `← Back` button left, a
 * kicker over an italic serif title centred, and a rust-filled action button
 * right (mock `music-pages.jsx:122-131,209-218`). `Album.tsx`/`Artist.tsx`
 * differ only in the kicker text, title size (62 vs 58), and the action's
 * label/icon — everything else, including the `20px 56px 14px` padding the
 * Centre Spread's masthead also uses (`CentreSpreadMasthead.tsx`'s own
 * comment on why that's tighter than the theme's standard rhythm), is
 * identical between the two, so it lives here once rather than twice.
 *
 * `← Back` is real browser history (`navigate(-1)`), the same as grid's own
 * `AlbumPage`/`ArtistPage` (read for reference only): both pages are reached
 * by tapping a track's artist/album from wherever that track was showing —
 * a shelf, a search result, another artist's discography rail — so "back"
 * only makes sense as "wherever that was", not a fixed parent screen.
 */
export function MusicPageMasthead({
  kicker,
  title,
  titleFontSize,
  actionLabel,
  actionIcon,
  onAction,
}: {
  kicker: string
  title: string
  titleFontSize: number
  actionLabel: string
  actionIcon: ReactNode
  onAction: () => void
}) {
  const navigate = useNavigate()

  return (
    <MastheadFrame
      padding="20px 56px 14px"
      left={
        <button type="button" onClick={() => navigate(-1)} style={backButtonStyle}>
          ← Back
        </button>
      }
      center={
        <>
          <div style={{ ...mastheadKickerStyle, textAlign: 'center' }}>{kicker}</div>
          <h1
            className="m-0 truncate"
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: titleFontSize,
              letterSpacing: '-0.03em',
              lineHeight: 0.9,
              color: 'var(--ink)',
            }}
          >
            {title}
          </h1>
        </>
      }
      right={
        <button type="button" onClick={onAction} style={actionButtonStyle}>
          {actionIcon} {actionLabel}
        </button>
      }
    />
  )
}

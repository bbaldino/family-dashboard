import { useSportsSection } from '@/integrations/sports'
import type { SportsSection } from '@/integrations/sports'
import { MastheadFrame } from '@/themes/broadsheet/ui/MastheadFrame'
import { mastheadKickerStyle, mastheadNumeralStyle } from '@/themes/broadsheet/ui/masthead-styles'
import { useNow } from '@/themes/broadsheet/home/useNow'
import { LeagueColumn } from '@/themes/broadsheet/sports/LeagueColumn'
import { SP_RULE } from '@/themes/broadsheet/sports/sports-tokens'

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

/** Date in the left ear, the page's name in the centre, and each league's
 *  season clock in the right ear. */
function Masthead({ now, clock }: { now: Date; clock: SportsSection['clock'] }) {
  return (
    <MastheadFrame
      padding="20px 56px 14px"
      left={<div style={mastheadKickerStyle}>{DATE_FORMAT.format(now)}</div>}
      center={
        <h1 className="m-0" style={mastheadNumeralStyle}>
          Sports
        </h1>
      }
      right={
        <div className="flex flex-col" style={{ gap: 1 }}>
          {clock.map((c) => (
            <div
              key={c.league}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'flex-end',
                gap: 10,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  color: 'var(--ink-muted)',
                }}
              >
                {c.detail}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 14,
                  fontWeight: 600,
                  minWidth: 34,
                  textAlign: 'right',
                }}
              >
                {c.league}
              </span>
            </div>
          ))}
        </div>
      }
    />
  )
}

/**
 * The Sporting Page — one full-height column per followed league, ordered
 * postseason → regular season → preseason → off-season (the backend orders
 * them). In-season columns take a full share; preseason and off-season ones
 * a narrower one. Every column separator runs top to bottom.
 *
 * Built and verified against `?scenario=sports-summer`, `sports-autumn`,
 * `sports-postseason` and `sports-eliminated`; see `useSportsSection`.
 *
 * Nothing here is tappable: articles carry only a headline and a short dek,
 * so there is nothing behind a tap worth showing.
 */
export function Sports() {
  const now = useNow()
  const { data } = useSportsSection()

  // No columns (nothing tracked, or every league's fetch failed) reads as an
  // empty page, not an empty grid.
  if (!data || data.columns.length === 0) {
    return (
      <div className="broadsheet-root w-[1600px] h-full flex flex-col">
        <Masthead now={now} clock={data?.clock ?? []} />
        <div
          className="flex-1 min-h-0 flex items-center justify-center"
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            color: 'var(--ink-muted)',
          }}
        >
          {data ? 'No sports to report.' : 'Checking the wires…'}
        </div>
        <div style={{ flexShrink: 0, height: 64 }} />
      </div>
    )
  }

  const widths = data.columns
    .map((c) => (c.phase === 'regular' || c.phase === 'postseason' ? '1fr' : '0.62fr'))
    .join(' ')

  return (
    <div className="broadsheet-root w-[1600px] h-full flex flex-col">
      <Masthead now={now} clock={data.clock} />
      <div
        data-testid="sports-body"
        className="flex-1 min-h-0 grid"
        style={{ gridTemplateColumns: widths }}
      >
        {data.columns.map((column, i) => {
          const first = i === 0
          const last = i === data.columns.length - 1
          return (
            <section
              key={column.league}
              style={{
                padding: `14px ${last ? 56 : 22}px 14px ${first ? 56 : 22}px`,
                borderRight: last ? undefined : `1px solid ${SP_RULE}`,
                overflow: 'hidden',
                minHeight: 0,
              }}
            >
              <LeagueColumn column={column} now={now} />
            </section>
          )
        })}
      </div>
      <div style={{ flexShrink: 0, height: 64 }} />
    </div>
  )
}

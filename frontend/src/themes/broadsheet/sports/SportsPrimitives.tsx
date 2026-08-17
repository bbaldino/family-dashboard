import type { StreakRow, SportsTrack } from '@/integrations/sports'
import { SP_RULE, SP_ACCENT2 } from './sports-tokens'

/** A win/loss streak — forest for a `W`, rust for an `L`. The one field in the
 *  feed that speaks to form, so it carries colour rather than plain ink. */
export function Streak({ value }: { value: string }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10.5,
        fontWeight: 700,
        color: value[0] === 'W' ? 'var(--forest)' : 'var(--rust)',
      }}
    >
      {value}
    </span>
  )
}

/** "Running hot" / "Cold snap" — a small labelled table of streaking teams. */
export function StreakList({ label, rows }: { label: string; rows: StreakRow[] }) {
  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
          borderBottom: `1px solid ${SP_RULE}`,
          paddingBottom: 2,
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      {rows.map((r) => (
        <div
          key={r.t}
          style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '2px 0' }}
        >
          <span
            style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, width: 32 }}
          >
            {r.t}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9.5,
              color: 'var(--ink-muted)',
              flex: 1,
            }}
          >
            {r.rec}
          </span>
          <Streak value={r.strk} />
        </div>
      ))}
    </div>
  )
}

/** A hairline league label above a track's block in the lower columns, so two
 *  parallel tracks on a split front read as separate sections. */
export function TrackLabel({ track }: { track: SportsTrack }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: SP_ACCENT2,
        fontWeight: 700,
      }}
    >
      {track.league}
    </div>
  )
}

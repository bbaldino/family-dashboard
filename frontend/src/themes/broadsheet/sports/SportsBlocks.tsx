import type { SportsTrack } from '@/integrations/sports'
import { Streak } from './SportsPrimitives'
import { SP_RULE, SP_INK2, SP_ME_ROW } from './sports-tokens'

/** A track's standings table, capped to `maxRows`. The followed team's row is
 *  washed rust and its figures set in rust and bold, so a glance finds it. */
export function TableBlock({
  track,
  maxRows,
  split,
}: {
  track: SportsTrack
  maxRows: number
  split: boolean
}) {
  const headStyle = (first: boolean) => ({
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    letterSpacing: '0.14em',
    color: 'var(--ink-muted)',
    fontWeight: 700,
    textAlign: (first ? 'left' : 'right') as 'left' | 'right',
    padding: '0 0 3px',
    borderBottom: '1px solid var(--ink)',
  })

  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: split ? 15 : 17,
          color: SP_INK2,
          margin: '3px 0 8px',
        }}
      >
        {track.table.title}
        {track.table.sub && (
          <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}> · {track.table.sub}</span>
        )}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={headStyle(true)}>Team</th>
            {['W', 'L', 'PCT', 'GB', 'STRK'].map((h) => (
              <th key={h} style={headStyle(false)}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {track.table.rows.slice(0, maxRows).map((r) => {
            const mono = (color: string) => ({
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              textAlign: 'right' as const,
              color,
            })
            return (
              <tr
                key={r.t}
                style={{
                  borderBottom: `1px dotted ${SP_RULE}`,
                  background: r.me ? SP_ME_ROW : 'transparent',
                }}
              >
                <td
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 14,
                    fontWeight: r.me ? 700 : 600,
                    color: r.me ? 'var(--rust)' : 'var(--ink)',
                    padding: '5px 0',
                  }}
                >
                  {r.t}
                </td>
                <td style={mono(r.me ? 'var(--rust)' : 'var(--ink)')}>{r.w}</td>
                <td style={mono('var(--ink-muted)')}>{r.l}</td>
                <td style={mono(SP_INK2)}>{r.pct}</td>
                <td style={mono('var(--ink-muted)')}>{r.gb}</td>
                <td style={{ textAlign: 'right' }}>
                  <Streak value={r.strk} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** A track's finals from the last slate, capped to `maxScores` with a "+N more
 *  finals" roll-up. Each game carries its standout performer — the strongest
 *  "notable player" line available, and free from the scoreboard call. */
export function ScoreBlock({
  track,
  maxScores,
  split,
}: {
  track: SportsTrack
  maxScores: number
  split: boolean
}) {
  const shown = track.scores.slice(0, maxScores)
  const hidden = track.scores.length - shown.length

  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: split ? 15 : 17,
          color: SP_INK2,
          margin: '3px 0 8px',
        }}
      >
        {track.scoresLabel} results
      </div>
      <div style={{ borderTop: '2px solid var(--ink)' }}>
        {shown.map((g, i) => {
          const awayWon = g.as > g.hs
          return (
            <div
              key={`${g.a}-${g.h}`}
              style={{ padding: '6.5px 0', borderTop: i === 0 ? 'none' : `1px dotted ${SP_RULE}` }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11.5,
                  letterSpacing: '0.04em',
                }}
              >
                <span
                  style={{
                    color: awayWon ? 'var(--ink)' : 'var(--ink-muted)',
                    fontWeight: awayWon ? 700 : 400,
                    width: 54,
                  }}
                >
                  {g.a} {g.as}
                </span>
                <span style={{ color: SP_RULE }}>@</span>
                <span
                  style={{
                    color: awayWon ? 'var(--ink-muted)' : 'var(--ink)',
                    fontWeight: awayWon ? 400 : 700,
                    width: 54,
                  }}
                >
                  {g.h} {g.hs}
                </span>
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontStyle: 'italic',
                  fontSize: 12,
                  color: 'var(--forest)',
                  marginTop: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {g.star}{' '}
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontStyle: 'normal',
                    fontSize: 9.5,
                    color: 'var(--ink-muted)',
                    letterSpacing: '0.02em',
                  }}
                >
                  {g.line}
                </span>
              </div>
            </div>
          )
        })}
        {hidden > 0 && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              fontStyle: 'italic',
              letterSpacing: '0.14em',
              color: 'var(--ink-muted)',
              padding: '6px 0 0',
              borderTop: `1px dotted ${SP_RULE}`,
              textTransform: 'uppercase',
            }}
          >
            +{hidden} more finals
          </div>
        )}
      </div>
    </div>
  )
}

/** A track's season leaders — `maxCats` categories, three deep each. Category
 *  names are league-specific (HR/AVG/ERA vs PPG/RPG/APG); the data carries
 *  them, so this only lays them out. */
export function LeaderBlock({ track, maxCats }: { track: SportsTrack; maxCats: number }) {
  return (
    <div>
      {track.leaders.slice(0, maxCats).map((c) => (
        <div key={c.cat} style={{ marginBottom: 7 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${SP_RULE}`,
              paddingBottom: 2,
              marginBottom: 3,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--ink-muted)',
              }}
            >
              {c.cat}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.12em',
                color: 'var(--rust)',
                fontWeight: 700,
              }}
            >
              {c.abbr}
            </span>
          </div>
          {c.rows.map(([name, team, value], j) => (
            <div
              key={name}
              style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '1.5px 0' }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 12.5,
                  flex: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontWeight: j === 0 ? 600 : 400,
                }}
              >
                {name}
              </span>
              <span
                style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-muted)' }}
              >
                {team}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10.5,
                  fontWeight: 700,
                  minWidth: 30,
                  textAlign: 'right',
                  color: j === 0 ? 'var(--ink)' : SP_INK2,
                }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

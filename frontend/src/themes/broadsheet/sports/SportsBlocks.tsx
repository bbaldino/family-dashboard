import type { StandingsTable, LeaderCategory } from '@/integrations/sports'
import { Streak } from './SportsPrimitives'
import { SP_RULE, SP_INK2, SP_ME_ROW } from './sports-tokens'

/** A league's standings table. Never truncated — a division is at most a
 *  handful of teams, and the table is one of the two blocks the spec forbids
 *  clipping (the other being the team card). The followed team's row is
 *  washed rust and its figures set in rust and bold, so a glance finds it.
 *  Rows are set at agate height (~22px) so an eight-team division still
 *  leaves the column room for scores and news.
 *  Empty rows (a failed standings fetch) read "Table unavailable." instead. */
export function DivisionTable({ table }: { table: StandingsTable }) {
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
          fontSize: 15,
          color: SP_INK2,
          margin: '3px 0 8px',
        }}
      >
        {table.title}
      </div>
      {table.rows.length === 0 && (
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            color: 'var(--ink-muted)',
          }}
        >
          Table unavailable.
        </div>
      )}
      {table.rows.length > 0 && (
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
            {table.rows.map((r) => {
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
                    lineHeight: 1.2,
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
                      padding: '2px 0',
                      lineHeight: 1.2,
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
      )}
    </div>
  )
}

/** A league's season leaders — `maxCats` categories, `depth` deep each.
 *  Category names are league-specific (HR/AVG/ERA vs PPG/RPG/APG); the data
 *  carries them, so this only lays them out. */
export function LeaderBlock({
  leaders,
  maxCats,
  depth = 3,
}: {
  leaders: LeaderCategory[]
  maxCats: number
  depth?: number
}) {
  return (
    <div>
      {leaders.slice(0, maxCats).map((c) => (
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
          {c.rows.slice(0, depth).map(([name, team, value], j) => (
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

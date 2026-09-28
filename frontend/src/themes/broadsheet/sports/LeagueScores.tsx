import type { ScoreSlate } from '@/integrations/sports'
import { formatUpcomingTime } from '@/integrations/sports'
import { SP_RULE, SP_ME_ROW, SP_SUB_LABEL } from './sports-tokens'

/**
 * The league's slate: the followed team's game first, then live games
 * (rust dot and ESPN's own status), today's upcoming ones by start time, then
 * recent finals with the winner in bold. Capped at `max`; the rest are named.
 */
export function LeagueScores({
  league,
  slate,
  max,
}: {
  league: string
  slate: ScoreSlate
  max: number
}) {
  const shown = slate.rows.slice(0, max)
  const hidden = slate.total - shown.length
  return (
    <div
      data-testid="league-scores"
      style={{ marginTop: 10, paddingTop: 6, borderTop: '1px solid var(--ink)' }}
    >
      <div style={SP_SUB_LABEL}>Around the {league}</div>
      {shown.map((g, i) => {
        const final = g.state === 'final'
        const awayWon = final && g.as > g.hs
        const homeWon = final && g.hs > g.as
        const side = (abbr: string, score: number, won: boolean) => (
          <span
            style={{
              fontWeight: won ? 700 : 400,
              color: final && !won ? 'var(--ink-muted)' : 'var(--ink)',
            }}
          >
            {g.state === 'upcoming' ? abbr : `${abbr} ${score}`}
          </span>
        )
        return (
          <div
            key={`${g.a}-${g.h}-${g.startsAt}`}
            className="flex items-baseline justify-between"
            style={{
              gap: 8,
              padding: '4px 2px',
              borderTop: i === 0 ? 'none' : `1px dotted ${SP_RULE}`,
              background: g.mine ? SP_ME_ROW : 'transparent',
              fontFamily: 'var(--font-mono)',
              fontSize: 11.5,
            }}
          >
            <span>
              {side(g.a, g.as, awayWon)} <span style={{ color: SP_RULE }}>·</span>{' '}
              {side(g.h, g.hs, homeWon)}
            </span>
            <span
              style={{
                ...SP_SUB_LABEL,
                color: g.state === 'live' ? 'var(--rust)' : 'var(--ink-muted)',
              }}
            >
              {g.state === 'live' && '● '}
              {g.state === 'upcoming' ? formatUpcomingTime(g.startsAt) : g.detail}
            </span>
          </div>
        )
      })}
      {hidden > 0 && (
        <div style={{ ...SP_SUB_LABEL, paddingTop: 4, borderTop: `1px dotted ${SP_RULE}` }}>
          +{hidden} more
        </div>
      )}
    </div>
  )
}

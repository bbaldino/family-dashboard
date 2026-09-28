import type { PostseasonRound, PostseasonView, SeriesRow } from '@/integrations/sports'
import { formatFinalDate, formatUpcomingTime } from '@/integrations/sports'
import { SP_RULE, SP_ME_ROW, SP_SUB_LABEL, clampLines } from './sports-tokens'

const bestOf = (n: number | null) => (n ? ` · best of ${n}` : '')

/** Each current round's series, trimmed left-to-right so the rounds together
 *  never exceed `maxSeries` — built as one immutable fold rather than a
 *  mutable running counter, so it stays a pure render-time computation. */
function trimToBudget(rounds: PostseasonRound[], maxSeries: number): SeriesRow[][] {
  return rounds.reduce<{ budget: number; rows: SeriesRow[][] }>(
    (acc, r) => {
      const rows = r.series.slice(0, Math.max(0, acc.budget))
      return { budget: acc.budget - rows.length, rows: [...acc.rows, rows] }
    },
    { budget: maxSeries, rows: [] },
  ).rows
}

/**
 * The league's whole postseason as a round-by-round list: each running round's
 * series (leader first and bold, the followed team's washed), finished rounds
 * folded to one line, and rounds still to come with their start. Series rows
 * across the current rounds are capped at `maxSeries`.
 */
export function PostseasonSeries({ view, maxSeries }: { view: PostseasonView; maxSeries: number }) {
  const totalSeries = view.current.reduce((n, r) => n + r.series.length, 0)
  const roundRows = trimToBudget(view.current, maxSeries)
  return (
    <div data-testid="postseason" style={{ marginTop: 10 }}>
      {view.current.map((r, roundIndex) => {
        const rows = roundRows[roundIndex]
        if (rows.length === 0) return null
        return (
          <div
            key={r.round}
            style={{ paddingTop: 6, marginTop: 4, borderTop: '1px solid var(--ink)' }}
          >
            <div style={SP_SUB_LABEL}>
              {r.round}
              {bestOf(r.bestOf)}
            </div>
            {rows.map((s, i) => (
              <div
                key={`${s.a}-${s.b}`}
                className="flex items-baseline justify-between"
                style={{
                  gap: 8,
                  padding: '4px 2px',
                  borderTop: i === 0 ? 'none' : `1px dotted ${SP_RULE}`,
                  background: s.mine ? SP_ME_ROW : 'transparent',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11.5,
                }}
              >
                <span>
                  <b>
                    {s.a} {s.aWins}
                  </b>{' '}
                  · {s.b} {s.bWins}
                </span>
                <span
                  style={{ ...SP_SUB_LABEL, color: s.live ? 'var(--rust)' : 'var(--ink-muted)' }}
                >
                  {s.live && '● '}
                  {s.detail}
                  {s.nextStartsAt && ` · ${formatUpcomingTime(s.nextStartsAt)}`}
                </span>
              </div>
            ))}
          </div>
        )
      })}
      {totalSeries > maxSeries && (
        <div style={{ ...SP_SUB_LABEL, paddingTop: 4 }}>+{totalSeries - maxSeries} more</div>
      )}

      {view.completed.length > 0 && (
        <div style={{ paddingTop: 6, marginTop: 8, borderTop: '1px solid var(--ink)' }}>
          <div style={SP_SUB_LABEL}>Done</div>
          {view.completed.map((c) => (
            <div
              key={c.round}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--ink-muted)',
                padding: '2px 0',
                ...clampLines(2),
              }}
            >
              {c.round} · {c.summary}
            </div>
          ))}
        </div>
      )}

      {view.upcoming.length > 0 && (
        <div style={{ paddingTop: 6, marginTop: 8, borderTop: '1px solid var(--ink)' }}>
          <div style={SP_SUB_LABEL}>Still to come</div>
          {view.upcoming.map((u) => (
            <div
              key={u.round}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--ink-muted)',
                padding: '2px 0',
              }}
            >
              {u.round}
              {bestOf(u.bestOf)} · starts {formatFinalDate(u.startsAt)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

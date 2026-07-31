import { useSportsGames, formatUpcomingTime } from '@/data/sports'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'

const proseStyle = {
  fontFamily: 'var(--font-display)',
  fontStyle: 'italic' as const,
  fontSize: 14,
  color: 'var(--ink-muted)',
}

/**
 * No game today (or the cache hasn't produced one yet): a written line
 * instead of an empty column, plus whatever's next on the schedule for the
 * tracked teams. Takes no props — it reads `useSportsGames` itself so
 * `SportsColumn` can render it before a game is even selected.
 */
export function OffdayBlock() {
  const { data, isLoading } = useSportsGames()
  const upcoming = (data?.games ?? []).filter((g) => g.state === 'upcoming').slice(0, 3)

  return (
    <div>
      <Kicker>Sports</Kicker>
      <h2
        className="m-0"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          lineHeight: 1.05,
          margin: '6px 0 10px',
        }}
      >
        No game today.
      </h2>
      <p className="m-0" style={{ ...proseStyle, marginBottom: 14 }}>
        {isLoading
          ? 'Checking the schedule…'
          : 'The column rests until the next first pitch. When a game lands on this date, it flexes back in here.'}
      </p>
      {upcoming.length > 0 && (
        <div className="pt-2.5" style={{ borderTop: '1px solid var(--rule)' }}>
          <Kicker>Next on the schedule</Kicker>
          <div className="mt-2">
            {upcoming.map((g, i) => (
              <div
                key={g.id}
                className="flex items-baseline gap-2.5 py-1.5"
                style={{ borderTop: i === 0 ? 'none' : '1px dotted var(--rule)' }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--ink-muted)',
                    letterSpacing: '0.06em',
                    width: 90,
                    flexShrink: 0,
                  }}
                >
                  {formatUpcomingTime(g.startTime)}
                </span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500 }}>
                  {g.away.abbreviation} @ {g.home.abbreviation}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

import {
  formatUnavailableLeagues,
  formatUpcomingTime,
  scoreboardIsDown,
} from '@/integrations/sports'
import type { GamesResponse } from '@/integrations/sports'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'

const proseStyle = {
  fontFamily: 'var(--font-display)',
  fontStyle: 'italic' as const,
  fontSize: 14,
  color: 'var(--ink-muted)',
}

/**
 * The sports column with no game to lead on. Three states, and telling them
 * apart is the point:
 *
 * - still loading — "Checking the schedule…",
 * - nothing on (no teams tracked, or none of them playing) — "No game
 *   today.", plus whatever's next on the schedule,
 * - a league the backend couldn't reach at all — "Scores are unavailable.",
 *   naming it.
 *
 * The third used to render as the second. ESPN began refusing our requests
 * and this column went on quietly reporting an off-day for weeks; the
 * failure was invisible precisely because its empty state was plausible.
 *
 * Takes sports data as props rather than calling `useSportsGames()` itself —
 * that hook opens its own SSE connection, and `Home` already calls it once
 * for the whole page (see `Home`'s doc comment). `SportsColumn` threads the
 * same data through so it can render this before a game is even selected.
 */
export function OffdayBlock({
  data,
  isLoading,
}: {
  data: GamesResponse | undefined
  isLoading: boolean
}) {
  const upcoming = (data?.games ?? []).filter((g) => g.state === 'upcoming').slice(0, 3)
  const isDown = scoreboardIsDown(data)

  return (
    <div>
      <Kicker color={isDown ? 'var(--rust)' : 'var(--ink-muted)'}>
        {isDown ? 'Sports · No report' : 'Sports · Off-day'}
      </Kicker>
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
        {isLoading
          ? 'Checking the schedule…'
          : isDown
            ? 'Scores are unavailable.'
            : 'No game today.'}
      </h2>
      {isDown && (
        /* Naming the league is what a boolean couldn't do: from the far side
         * of the kitchen this says whether the scoreboard is out or the
         * season simply is. Same distinction the Health screen's ledger
         * draws, in the same voice. */
        <p className="m-0" style={{ ...proseStyle, color: 'var(--rust)', marginBottom: 14 }}>
          No word from {formatUnavailableLeagues(data?.unavailableLeagues ?? [])} — the scoreboard
          is down, not quiet.
        </p>
      )}
      {/* Only the loading line survives here. What replaced it said the column
          "rests until the next first pitch" and would "flex back in here" —
          true of the layout, and no use to someone glancing at a wall display.
          The heading already reports the fact; anything past it was the page
          describing itself. */}
      {isLoading && (
        <p className="m-0" style={{ ...proseStyle, marginBottom: 14 }}>
          The schedule for today hasn’t loaded yet.
        </p>
      )}
      {upcoming.length > 0 && (
        <div className="pt-2.5" style={{ borderTop: '1px solid var(--rule)' }}>
          <Kicker color="var(--ink-muted)">Next on the schedule</Kicker>
          <div className="mt-2">
            {upcoming.map((g, i) => (
              <div
                key={g.id}
                className="flex items-baseline gap-2.5 py-1.5"
                style={{ borderTop: i === 0 ? 'none' : '1px dotted var(--rule)' }}
              >
                {/* min-width, not width: formatUpcomingTime()'s longest form
                 *  ("Wed Oct 5, 9:00 PM") runs past a 90px fixed box — a
                 *  min-width keeps the column loosely aligned without
                 *  wrapping or clipping the far end of the string. */}
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--ink-muted)',
                    letterSpacing: '0.06em',
                    minWidth: 90,
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
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

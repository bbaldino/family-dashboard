import type { Game, GameTeam, LinescoreEntry, MlbSituationData, Play } from '@/integrations/sports'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'
import { TeamCap } from '@/themes/broadsheet/ui/TeamCap'

/** Diamond of three bases, lit in rust when occupied. MLB-only situation data. */
function BasesDiamond({ situation, size = 44 }: { situation: MlbSituationData; size?: number }) {
  const base = (filled: boolean) => ({
    position: 'absolute' as const,
    width: size * 0.3,
    height: size * 0.3,
    background: filled ? 'var(--rust)' : 'var(--paper)',
    border: '1.5px solid var(--ink)',
    transform: 'rotate(45deg)',
  })
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <div
        style={{ ...base(situation.onSecond), top: 0, left: '50%', marginLeft: -(size * 0.15) }}
      />
      <div style={{ ...base(situation.onFirst), bottom: size * 0.1, right: 0 }} />
      <div style={{ ...base(situation.onThird), bottom: size * 0.1, left: 0 }} />
    </div>
  )
}

/** A row of filled/empty dots — balls, strikes, or outs. */
function CountDots({ label, count, max }: { label: string; count: number; max: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--ink-muted)',
          width: 12,
        }}
      >
        {label}
      </span>
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className="rounded-full"
          style={{
            width: 7,
            height: 7,
            background: i < count ? 'var(--rust)' : 'transparent',
            border: '1px solid var(--ink-muted)',
          }}
        />
      ))}
    </div>
  )
}

/** Score block: caps, records, big Newsreader numerals for the score. */
function ScoreLine({ home, away }: { home: GameTeam; away: GameTeam }) {
  const homeAhead = (home.score ?? 0) > (away.score ?? 0)
  const awayAhead = (away.score ?? 0) > (home.score ?? 0)
  return (
    <div
      className="grid items-center gap-3.5 py-2.5"
      style={{
        gridTemplateColumns: '1fr auto 1fr',
        borderTop: '2px solid var(--ink)',
        borderBottom: '2px solid var(--ink)',
      }}
    >
      <div className="flex items-center gap-3.5">
        <TeamCap
          short={away.abbreviation}
          primary={away.color}
          secondary={away.altColor}
          size={48}
        />
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.18em',
              color: 'var(--ink-muted)',
            }}
          >
            AWAY{away.record ? ` · ${away.record}` : ''}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }}>
            {away.name}
          </div>
        </div>
      </div>
      <div
        className="flex items-center gap-4"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 64,
          fontWeight: 400,
          letterSpacing: '-0.03em',
          lineHeight: 0.85,
        }}
      >
        <span style={{ color: awayAhead ? 'var(--ink)' : 'var(--ink-muted)' }}>
          {away.score ?? '–'}
        </span>
        <span style={{ width: 12, height: 2, background: 'var(--ink)' }} />
        <span style={{ color: homeAhead ? 'var(--ink)' : 'var(--ink-muted)' }}>
          {home.score ?? '–'}
        </span>
      </div>
      <div className="flex items-center gap-3.5 justify-end text-right">
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.18em',
              color: 'var(--ink-muted)',
            }}
          >
            HOME{home.record ? ` · ${home.record}` : ''}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }}>
            {home.name}
          </div>
        </div>
        <TeamCap
          short={home.abbreviation}
          primary={home.color}
          secondary={home.altColor}
          size={48}
        />
      </div>
    </div>
  )
}

/** Inning-by-inning line score, plus runs/hits/errors. Nothing to show without linescores. */
function LineScoreTable({ game }: { game: Game }) {
  if (game.linescores.length === 0) return null
  const rows: {
    abbr: string
    entries: LinescoreEntry[]
    runs: number | null
    hits: number | null
    errors: number | null
  }[] = [
    {
      abbr: game.away.abbreviation,
      entries: game.linescores,
      runs: game.away.score,
      hits: game.away.hits,
      errors: game.away.errors,
    },
    {
      abbr: game.home.abbreviation,
      entries: game.linescores,
      runs: game.home.score,
      hits: game.home.hits,
      errors: game.home.errors,
    },
  ]
  return (
    <div className="pt-2">
      <table
        className="w-full border-collapse"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}
      >
        <thead>
          <tr style={{ color: 'var(--ink-muted)' }}>
            <th />
            {game.linescores.map((entry) => (
              <th
                key={entry.period}
                className="text-center font-normal"
                style={{ padding: '4px 0' }}
              >
                {entry.period}
              </th>
            ))}
            <th
              className="text-center font-bold"
              style={{ padding: '4px 0 4px 10px', color: 'var(--ink)' }}
            >
              R
            </th>
            <th className="text-center font-normal" style={{ padding: '4px 0' }}>
              H
            </th>
            <th className="text-center font-normal" style={{ padding: '4px 0' }}>
              E
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--rule)' }}>
              <td className="font-bold" style={{ padding: '6px 4px', letterSpacing: '0.1em' }}>
                {row.abbr}
              </td>
              {row.entries.map((entry) => {
                const value = i === 0 ? entry.awayScore : entry.homeScore
                return (
                  <td
                    key={entry.period}
                    className="text-center"
                    style={{ color: value ? 'var(--ink)' : 'var(--ink-muted)' }}
                  >
                    {value || '·'}
                  </td>
                )
              })}
              <td
                className="text-center font-bold"
                style={{ paddingLeft: 10, color: 'var(--ink)' }}
              >
                {row.runs ?? '–'}
              </td>
              <td className="text-center" style={{ color: 'var(--ink-muted)' }}>
                {row.hits ?? '–'}
              </td>
              <td className="text-center" style={{ color: 'var(--ink-muted)' }}>
                {row.errors ?? '–'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * How many leader lines and scoring/recent-play lines this block ever
 * renders, regardless of how many the feed returns. The body row is a
 * fixed 521px with `overflow-hidden` as the safety net (see Home's body
 * row) — score line, situation, matchup, win-probability bar, and line
 * score above already spend ~335px, leaving ~186px for leaders and plays
 * combined. Leaders run ~137px at their observed length; the real feed's
 * play text (~70 chars) wraps to two lines at 12px in this column's
 * ~265px width, so each play line costs ~40px. A high-scoring game — six
 * runs is unremarkable — blew through the remaining budget by ~300px and
 * got clipped mid-sentence. These caps make the cut land between items
 * instead of through one, the same treatment `ScheduleColumn` gives its
 * day list.
 */
const MAX_VISIBLE_LEADERS = 3
const MAX_VISIBLE_SCORING_PLAYS = 3
const MAX_VISIBLE_RECENT_PLAYS = 3

/** `T5`, `B7` — a single letter for the half plus the inning number, per the
 *  mock (`broadsheet-v2.jsx:456`, `shared.jsx`'s `scoring` entries). The real
 *  feed's `inningHalf` is a whole word ("Top"/"Bottom", and inconsistently
 *  cased across sources) — this both matches the mock and fixes a real
 *  overflow bug: the old code rendered the full word in a fixed-width box
 *  narrower than its content ("Bottom1" in a 22px box), so glyphs spilled
 *  onto the play text next to it. Empty string (not a placeholder) when
 *  either half is missing, same as the rest of this file's null guards. */
function formatInningLabel(play: Play): string {
  if (!play.inningHalf || play.inningNumber == null) return ''
  return `${play.inningHalf.charAt(0).toUpperCase()}${play.inningNumber}`
}

/** One play line: inning marker plus the feed's play text. */
function PlayLine({ play, accent }: { play: Play; accent?: boolean }) {
  return (
    <li
      className="flex gap-2"
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: 12,
        lineHeight: 1.4,
        color: accent ? undefined : 'var(--ink-muted)',
      }}
    >
      {/* `min-width` for column alignment, not `width` — a fixed width
       *  narrower than the content clips/overlaps instead of just losing
       *  alignment, which is worse. Double-digit innings (T12) still need
       *  to be able to grow past it. */}
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: accent ? 'var(--rust)' : undefined,
          fontWeight: 700,
          minWidth: 20,
          flexShrink: 0,
        }}
      >
        {formatInningLabel(play)}
      </span>
      <span>{play.text}</span>
    </li>
  )
}

/**
 * The full takeover: score, count/bases, matchup, win probability, line
 * score, and plays. Nearly every field here is nullable on the real ESPN
 * feed (`situation`, `liveDetail`, `linescores`, `hits`/`errors`) — each
 * section guards its own data and renders nothing rather than throwing.
 */
export function LiveGame({ game }: { game: Game }) {
  const mlbSituation = game.situation?.type === 'mlb' ? game.situation : null
  const detail = game.liveDetail
  const matchup = detail?.matchup
  const winProbability = detail?.winProbability
  const leaders = detail?.leaders
  const scoringRecap = detail?.scoringRecap ?? null

  // The recap already collapses every completed inning into a sentence or
  // two — far cheaper on space than a line per play — so prefer it once
  // the backend has cached one. Only the still-in-progress half-inning's
  // plays (which the recap can't describe yet) render as a list alongside
  // it. Before a recap exists (first poll or so of a fresh live game), fall
  // back to the raw scoring list, capped the same way.
  const visibleScoringPlays = (
    scoringRecap ? (detail?.inProgressScoring ?? []) : (detail?.scoringPlays ?? [])
  ).slice(0, MAX_VISIBLE_SCORING_PLAYS)
  const visibleRecentPlays = (detail?.recentPlays ?? []).slice(0, MAX_VISIBLE_RECENT_PLAYS)
  const visibleLeadersAway = (leaders?.away ?? []).slice(0, MAX_VISIBLE_LEADERS)
  const visibleLeadersHome = (leaders?.home ?? []).slice(0, MAX_VISIBLE_LEADERS)

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="rounded-full" style={{ width: 8, height: 8, background: 'var(--rust)' }} />
        <Kicker>
          Live{game.periodLabel ? ` · ${game.periodLabel}` : ''}
          {game.broadcast ? ` · ${game.broadcast}` : ''}
        </Kicker>
        <span className="flex-1" style={{ height: 1, background: 'var(--rule)' }} />
      </div>

      {game.headline && (
        <h2
          className="m-0"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            lineHeight: 1,
            marginBottom: 12,
          }}
        >
          {game.headline}
        </h2>
      )}

      <ScoreLine home={game.home} away={game.away} />

      {mlbSituation && (
        <div
          className="grid items-center gap-4 py-2.5"
          style={{ gridTemplateColumns: 'auto auto 1fr', borderBottom: '1px solid var(--rule)' }}
        >
          <div className="text-center">
            <BasesDiamond situation={mlbSituation} />
          </div>
          <div className="flex flex-col gap-1">
            <CountDots label="B" count={mlbSituation.balls ?? 0} max={3} />
            <CountDots label="S" count={mlbSituation.strikes ?? 0} max={2} />
            <CountDots label="O" count={mlbSituation.outs} max={2} />
          </div>
          {(mlbSituation.pitcher || mlbSituation.batter) && (
            <div className="flex flex-col gap-1">
              {mlbSituation.pitcher && (
                <div
                  style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--ink)' }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      color: 'var(--ink-muted)',
                      letterSpacing: '0.12em',
                    }}
                  >
                    PITCHING{' '}
                  </span>
                  {mlbSituation.pitcher}
                </div>
              )}
              {mlbSituation.batter && (
                <div
                  style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--ink)' }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      color: 'var(--ink-muted)',
                      letterSpacing: '0.12em',
                    }}
                  >
                    AT BAT{' '}
                  </span>
                  {mlbSituation.batter}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {matchup && (
        <div
          className="grid grid-cols-2 gap-4 py-2.5"
          style={{ borderBottom: '1px solid var(--rule)' }}
        >
          <div>
            <Kicker>Pitching</Kicker>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 15,
                fontStyle: 'italic',
                fontWeight: 500,
              }}
            >
              {matchup.pitcher.name}
            </div>
            {matchup.pitcher.era && (
              <div
                style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)' }}
              >
                ERA {matchup.pitcher.era}
              </div>
            )}
          </div>
          <div>
            <Kicker>At bat</Kicker>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 15,
                fontStyle: 'italic',
                fontWeight: 500,
              }}
            >
              {matchup.batter.name}
            </div>
            {matchup.batter.avg && (
              <div
                style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)' }}
              >
                {matchup.batter.avg} AVG
              </div>
            )}
          </div>
        </div>
      )}

      {winProbability && (
        <div className="py-2.5">
          {/* Round one side and derive the other from it — rounding both
           *  independently can land on 101 (or 99) together, e.g. 20/81. */}
          {(() => {
            const awayPct = Math.round(winProbability.away * 100)
            const homePct = 100 - awayPct
            return (
              <>
                <div
                  className="flex justify-between mb-1"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--ink-muted)',
                    letterSpacing: '0.1em',
                  }}
                >
                  <span>
                    WIN PROB · {game.away.abbreviation} {awayPct}%
                  </span>
                  <span>
                    {homePct}% {game.home.abbreviation}
                  </span>
                </div>
                <div className="flex" style={{ height: 6, background: 'var(--rule)' }}>
                  <div style={{ width: `${awayPct}%`, background: 'var(--rust)' }} />
                  <div className="flex-1" style={{ background: 'var(--forest)' }} />
                </div>
              </>
            )
          })()}
        </div>
      )}

      <LineScoreTable game={game} />

      {(visibleLeadersAway.length > 0 || visibleLeadersHome.length > 0) && (
        <div
          className="grid grid-cols-2 gap-4 mt-3 pt-2.5"
          style={{ borderTop: '1px solid var(--rule)' }}
        >
          <div>
            <Kicker>Leaders · {game.away.abbreviation}</Kicker>
            <ul className="m-0 mt-1.5 p-0 flex flex-col gap-1" style={{ listStyle: 'none' }}>
              {visibleLeadersAway.map((l, i) => (
                <li
                  key={i}
                  className="flex justify-between"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
                >
                  <span>{l.playerName}</span>
                  <span style={{ color: 'var(--ink-muted)' }}>{l.displayValue}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Kicker>Leaders · {game.home.abbreviation}</Kicker>
            <ul className="m-0 mt-1.5 p-0 flex flex-col gap-1" style={{ listStyle: 'none' }}>
              {visibleLeadersHome.map((l, i) => (
                <li
                  key={i}
                  className="flex justify-between"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
                >
                  <span>{l.playerName}</span>
                  <span style={{ color: 'var(--ink-muted)' }}>{l.displayValue}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {(scoringRecap || visibleScoringPlays.length > 0 || visibleRecentPlays.length > 0) && (
        <div
          className="grid grid-cols-2 gap-4 mt-3 pt-2.5"
          style={{ borderTop: '1px solid var(--rule)' }}
        >
          {(scoringRecap || visibleScoringPlays.length > 0) && (
            <div>
              <Kicker>Scoring</Kicker>
              {scoringRecap && (
                <p
                  className="m-0 mt-1.5"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontStyle: 'italic',
                    fontSize: 12,
                    lineHeight: 1.4,
                  }}
                >
                  {scoringRecap.text}
                </p>
              )}
              {visibleScoringPlays.length > 0 && (
                <ul className="m-0 mt-1.5 p-0 flex flex-col gap-1" style={{ listStyle: 'none' }}>
                  {visibleScoringPlays.map((play) => (
                    <PlayLine key={play.id} play={play} accent />
                  ))}
                </ul>
              )}
            </div>
          )}
          {visibleRecentPlays.length > 0 && (
            <div>
              <Kicker color="var(--ink-muted)">Recent</Kicker>
              <ul className="m-0 mt-1.5 p-0 flex flex-col gap-1" style={{ listStyle: 'none' }}>
                {visibleRecentPlays.map((play) => (
                  <PlayLine key={play.id} play={play} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

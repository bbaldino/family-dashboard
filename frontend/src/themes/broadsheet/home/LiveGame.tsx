import type { Game, GameTeam, LinescoreEntry, MlbSituationData } from '@/data/sports'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'
import { TeamCap } from '@/themes/broadsheet/ui/TeamCap'

/** ESPN's team colours arrive without a leading '#'; be forgiving either way. */
function toHex(color: string | null): string | null {
  if (!color) return null
  return color.startsWith('#') ? color : `#${color}`
}

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
      <div style={{ ...base(situation.onSecond), top: 0, left: '50%', marginLeft: -(size * 0.15) }} />
      <div style={{ ...base(situation.onFirst), bottom: size * 0.1, right: 0 }} />
      <div style={{ ...base(situation.onThird), bottom: size * 0.1, left: 0 }} />
    </div>
  )
}

/** A row of filled/empty dots — balls, strikes, or outs. */
function CountDots({ label, count, max }: { label: string; count: number; max: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)', width: 12 }}>{label}</span>
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
      style={{ gridTemplateColumns: '1fr auto 1fr', borderTop: '2px solid var(--ink)', borderBottom: '2px solid var(--ink)' }}
    >
      <div className="flex items-center gap-3.5">
        <TeamCap short={away.abbreviation} primary={toHex(away.color)} secondary={toHex(away.altColor)} size={48} />
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', color: 'var(--ink-muted)' }}>
            AWAY{away.record ? ` · ${away.record}` : ''}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }}>{away.name}</div>
        </div>
      </div>
      <div
        className="flex items-center gap-4"
        style={{ fontFamily: 'var(--font-display)', fontSize: 64, fontWeight: 400, letterSpacing: '-0.03em', lineHeight: 0.85 }}
      >
        <span style={{ color: awayAhead ? 'var(--ink)' : 'var(--ink-muted)' }}>{away.score ?? '–'}</span>
        <span style={{ width: 12, height: 2, background: 'var(--ink)' }} />
        <span style={{ color: homeAhead ? 'var(--ink)' : 'var(--ink-muted)' }}>{home.score ?? '–'}</span>
      </div>
      <div className="flex items-center gap-3.5 justify-end text-right">
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', color: 'var(--ink-muted)' }}>
            HOME{home.record ? ` · ${home.record}` : ''}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }}>{home.name}</div>
        </div>
        <TeamCap short={home.abbreviation} primary={toHex(home.color)} secondary={toHex(home.altColor)} size={48} />
      </div>
    </div>
  )
}

/** Inning-by-inning line score, plus runs/hits/errors. Nothing to show without linescores. */
function LineScoreTable({ game }: { game: Game }) {
  if (game.linescores.length === 0) return null
  const rows: { abbr: string; entries: LinescoreEntry[]; runs: number | null; hits: number | null; errors: number | null }[] = [
    { abbr: game.away.abbreviation, entries: game.linescores, runs: game.away.score, hits: game.away.hits, errors: game.away.errors },
    { abbr: game.home.abbreviation, entries: game.linescores, runs: game.home.score, hits: game.home.hits, errors: game.home.errors },
  ]
  return (
    <div className="pt-2">
      <table className="w-full border-collapse" style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
        <thead>
          <tr style={{ color: 'var(--ink-muted)' }}>
            <th />
            {game.linescores.map((entry) => (
              <th key={entry.period} className="text-center font-normal" style={{ padding: '4px 0' }}>
                {entry.period}
              </th>
            ))}
            <th className="text-center font-bold" style={{ padding: '4px 0 4px 10px', color: 'var(--ink)' }}>
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
                  <td key={entry.period} className="text-center" style={{ color: value ? 'var(--ink)' : 'var(--ink-muted)' }}>
                    {value || '·'}
                  </td>
                )
              })}
              <td className="text-center font-bold" style={{ paddingLeft: 10, color: 'var(--ink)' }}>
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
  const scoringPlays = detail?.scoringPlays ?? []
  const recentPlays = detail?.recentPlays ?? []
  const leaders = detail?.leaders

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="rounded-full"
          style={{ width: 8, height: 8, background: 'var(--rust)' }}
        />
        <Kicker>
          Live{game.periodLabel ? ` · ${game.periodLabel}` : ''}
          {game.broadcast ? ` · ${game.broadcast}` : ''}
        </Kicker>
        <span className="flex-1" style={{ height: 1, background: 'var(--rule)' }} />
      </div>

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
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--ink)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-muted)', letterSpacing: '0.12em' }}>
                    PITCHING{' '}
                  </span>
                  {mlbSituation.pitcher}
                </div>
              )}
              {mlbSituation.batter && (
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--ink)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-muted)', letterSpacing: '0.12em' }}>
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
        <div className="grid grid-cols-2 gap-4 py-2.5" style={{ borderBottom: '1px solid var(--rule)' }}>
          <div>
            <Kicker>Pitching</Kicker>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontStyle: 'italic', fontWeight: 500 }}>
              {matchup.pitcher.name}
            </div>
            {matchup.pitcher.era && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)' }}>
                ERA {matchup.pitcher.era}
              </div>
            )}
          </div>
          <div>
            <Kicker>At bat</Kicker>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontStyle: 'italic', fontWeight: 500 }}>
              {matchup.batter.name}
            </div>
            {matchup.batter.avg && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)' }}>
                {matchup.batter.avg} AVG
              </div>
            )}
          </div>
        </div>
      )}

      {winProbability && (
        <div className="py-2.5">
          <div
            className="flex justify-between mb-1"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)', letterSpacing: '0.1em' }}
          >
            <span>
              WIN PROB · {game.away.abbreviation} {Math.round(winProbability.away * 100)}%
            </span>
            <span>
              {Math.round(winProbability.home * 100)}% {game.home.abbreviation}
            </span>
          </div>
          <div className="flex" style={{ height: 6, background: 'var(--rule)' }}>
            <div style={{ width: `${Math.round(winProbability.away * 100)}%`, background: 'var(--rust)' }} />
            <div className="flex-1" style={{ background: 'var(--forest)' }} />
          </div>
        </div>
      )}

      <LineScoreTable game={game} />

      {(leaders?.home.length || leaders?.away.length) ? (
        <div className="grid grid-cols-2 gap-4 mt-3 pt-2.5" style={{ borderTop: '1px solid var(--rule)' }}>
          <div>
            <Kicker>Leaders · {game.away.abbreviation}</Kicker>
            <ul className="m-0 mt-1.5 p-0 flex flex-col gap-1" style={{ listStyle: 'none' }}>
              {(leaders?.away ?? []).map((l, i) => (
                <li key={i} className="flex justify-between" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  <span>{l.playerName}</span>
                  <span style={{ color: 'var(--ink-muted)' }}>{l.displayValue}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Kicker>Leaders · {game.home.abbreviation}</Kicker>
            <ul className="m-0 mt-1.5 p-0 flex flex-col gap-1" style={{ listStyle: 'none' }}>
              {(leaders?.home ?? []).map((l, i) => (
                <li key={i} className="flex justify-between" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  <span>{l.playerName}</span>
                  <span style={{ color: 'var(--ink-muted)' }}>{l.displayValue}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {(scoringPlays.length > 0 || recentPlays.length > 0) && (
        <div className="grid grid-cols-2 gap-4 mt-3 pt-2.5" style={{ borderTop: '1px solid var(--rule)' }}>
          {scoringPlays.length > 0 && (
            <div>
              <Kicker>Scoring</Kicker>
              <ul className="m-0 mt-1.5 p-0 flex flex-col gap-1" style={{ listStyle: 'none' }}>
                {scoringPlays.map((play) => (
                  <li key={play.id} className="flex gap-2" style={{ fontFamily: 'var(--font-display)', fontSize: 12, lineHeight: 1.4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--rust)', fontWeight: 700, width: 22, flexShrink: 0 }}>
                      {play.inningHalf ?? ''}
                      {play.inningNumber ?? ''}
                    </span>
                    <span>{play.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {recentPlays.length > 0 && (
            <div>
              <Kicker>Recent</Kicker>
              <ul className="m-0 mt-1.5 p-0 flex flex-col gap-1" style={{ listStyle: 'none' }}>
                {recentPlays.map((play) => (
                  <li
                    key={play.id}
                    className="flex gap-2"
                    style={{ fontFamily: 'var(--font-display)', fontSize: 12, lineHeight: 1.4, color: 'var(--ink-muted)' }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, width: 28, flexShrink: 0 }}>
                      {play.inningHalf ?? ''}
                      {play.inningNumber ?? ''}
                    </span>
                    <span>{play.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

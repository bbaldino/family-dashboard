import { useSportsPreview, formatUpcomingTime } from '@/integrations/sports'
import type { Game, GameAthlete } from '@/integrations/sports'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'
import { TeamCap } from '@/themes/broadsheet/ui/TeamCap'

function probablePitcher(athletes: GameAthlete[], side: 'home' | 'away'): GameAthlete | undefined {
  return athletes.find((a) => a.role === 'probable' && a.team === side)
}

/** One team's card: cap, record, name, and its probable starter if known. */
function TeamSide({
  side,
  team,
  pitcher,
}: {
  side: 'Away' | 'Home'
  team: Game['home']
  pitcher?: GameAthlete
}) {
  return (
    <div className="flex gap-3 items-start">
      <TeamCap short={team.abbreviation} primary={team.color} secondary={team.altColor} size={42} />
      <div className="min-w-0 flex-1">
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.18em',
            color: 'var(--ink-muted)',
          }}
        >
          {side.toUpperCase()}
          {team.record ? ` · ${team.record}` : ''}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>
          {team.name}
        </div>
        {pitcher && (
          <div className="mt-2">
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.16em',
                color: 'var(--ink-muted)',
              }}
            >
              PROBABLE
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 14,
                fontStyle: 'italic',
                fontWeight: 500,
              }}
            >
              {pitcher.name}
            </div>
            {pitcher.stats && (
              <div
                style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)' }}
              >
                {pitcher.stats}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * A scheduled game, not yet underway: both teams, their probable starters
 * when ESPN has posted them, and — when the AI preview has finished
 * generating — a short written blurb. `liveDetail` is only ever populated
 * for live/final games (the backend never fetches a summary for an
 * upcoming one), so probable pitchers come from `game.athletes` instead.
 */
export function PregameBlock({ game }: { game: Game }) {
  const { data } = useSportsPreview(game.id)

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <Kicker>
          {formatUpcomingTime(game.startTime)}
          {game.broadcast ? ` · ${game.broadcast}` : ''}
        </Kicker>
        <span className="flex-1" style={{ height: 1, background: 'var(--rule)' }} />
      </div>
      <h2
        className="m-0"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 32,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          lineHeight: 1,
          marginBottom: 14,
        }}
      >
        <span style={{ fontStyle: 'italic' }}>{game.away.name}</span> at {game.home.name}.
      </h2>
      <div
        className="grid grid-cols-2 gap-4 py-3.5"
        style={{ borderTop: '2px solid var(--ink)', borderBottom: '1px solid var(--rule)' }}
      >
        <TeamSide side="Away" team={game.away} pitcher={probablePitcher(game.athletes, 'away')} />
        <TeamSide side="Home" team={game.home} pitcher={probablePitcher(game.athletes, 'home')} />
      </div>
      {/* The preview only when there is one. Its old fallback announced that
          "the page will widen and the scoreboard will fill this space when
          first pitch lands" — the interface narrating its own layout, which is
          not information about the game and read as filler on a cold cache. */}
      {data?.summary && (
        <p
          className="m-0 mt-3"
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--ink-muted)',
            lineHeight: 1.5,
          }}
        >
          {data.summary}
        </p>
      )}
    </div>
  )
}

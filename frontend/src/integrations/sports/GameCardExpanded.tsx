import type { Game, Leader } from './types'
import { AiPreview } from './AiPreview'
import { MlbSituation } from './MlbSituation'
import { MlbLinescore } from './MlbLinescore'
import { NbaLinescore } from './NbaLinescore'
import { LastPlayBar } from './LastPlayBar'
import { GameHeadline } from './GameHeadline'

interface GameCardExpandedProps {
  game: Game
  allGames: Game[]
  onClick?: () => void
}

function LeadersList({ leaders }: { leaders: Leader[] }) {
  if (leaders.length === 0) return null
  return (
    <div className="mt-3">
      <div className="text-xs font-medium text-text-secondary mb-1">Leaders</div>
      <div className="space-y-0.5">
        {leaders.map((l, i) => (
          <div key={i} className="text-xs flex justify-between">
            <span className="text-text-primary">{l.name}</span>
            <span className="text-text-secondary">{l.stats}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function UpcomingSchedule({ games, currentGameId }: { games: Game[]; currentGameId: string }) {
  const upcoming = games
    .filter((g) => g.id !== currentGameId && g.state === 'upcoming')
    .slice(0, 3)

  if (upcoming.length === 0) return null

  return (
    <div className="mt-3">
      <div className="text-xs font-medium text-text-secondary mb-1">Coming Up</div>
      <div className="space-y-1">
        {upcoming.map((g) => {
          const d = new Date(g.startTime)
          const day = d.toLocaleDateString([], { weekday: 'short' })
          const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
          return (
            <div key={g.id} className="text-xs flex justify-between text-text-secondary">
              <span>{g.away.abbreviation} vs {g.home.abbreviation}</span>
              <span>{day} {time}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SportLinescore({ game }: { game: Game }) {
  if (game.league === 'mlb') return <MlbLinescore game={game} />
  if (game.league === 'nba') return <NbaLinescore game={game} />
  // Generic fallback for NHL/NFL — reuse NBA's quarter-style table
  if (game.linescores.length === 0) return null
  return <NbaLinescore game={game} />
}

export function GameCardExpanded({ game, allGames, onClick }: GameCardExpandedProps) {
  const isLive = game.state === 'live'
  const isFinal = game.state === 'final'
  const isUpcoming = game.state === 'upcoming'

  return (
    <div className="cursor-pointer" onClick={onClick}>
      {/* Main matchup header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {game.away.logo && <img src={game.away.logo} alt="" className="w-8 h-8 object-contain" />}
          <div>
            <div className="text-sm font-bold text-text-primary">{game.away.name}</div>
            <div className="text-xs text-text-secondary">{game.away.record}</div>
          </div>
        </div>

        <div className="text-center">
          {(isLive || isFinal) ? (
            <div className="text-lg font-bold text-text-primary">
              {game.away.score} - {game.home.score}
            </div>
          ) : (
            <div className="text-xs text-text-secondary">vs</div>
          )}
          {isLive && (
            <div className="text-xs text-error font-medium">{game.periodLabel}</div>
          )}
          {isFinal && (
            <div className="text-xs text-text-secondary">Final</div>
          )}
          {isUpcoming && (
            <div className="text-xs text-text-secondary">
              {new Date(game.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-sm font-bold text-text-primary">{game.home.name}</div>
            <div className="text-xs text-text-secondary">{game.home.record}</div>
          </div>
          {game.home.logo && <img src={game.home.logo} alt="" className="w-8 h-8 object-contain" />}
        </div>
      </div>

      {/* Live: sport-specific situation */}
      {isLive && game.situation?.type === 'mlb' && (
        <MlbSituation situation={game.situation} />
      )}

      {/* Live: last play */}
      {isLive && game.lastPlay && (
        <LastPlayBar text={game.lastPlay} />
      )}

      {/* Live + Final: sport-specific linescore */}
      {(isLive || isFinal) && <SportLinescore game={game} />}

      {/* Live + Final: leaders */}
      {(isLive || isFinal) && <LeadersList leaders={game.allLeaders ?? game.leaders} />}

      {/* Final: ESPN recap headline */}
      {isFinal && game.headline && <GameHeadline text={game.headline} />}

      {/* Upcoming: athletes (probable pitchers, etc) */}
      {isUpcoming && game.athletes.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-medium text-text-secondary mb-1">
            {game.league === 'mlb' ? 'Probable Pitchers' : 'Notable'}
          </div>
          <div className="space-y-0.5">
            {game.athletes.map((a, i) => (
              <div key={i} className="text-xs flex justify-between">
                <span className="text-text-primary">{a.name}</span>
                <span className="text-text-secondary">{a.stats ?? a.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming: broadcast info */}
      {isUpcoming && game.broadcast && (
        <div className="mt-2 text-xs text-text-muted">
          {game.broadcast}
        </div>
      )}

      {/* Upcoming: schedule + AI preview */}
      {isUpcoming && <UpcomingSchedule games={allGames} currentGameId={game.id} />}
      {isUpcoming && <AiPreview gameId={game.id} />}
    </div>
  )
}

import type { Game, Leader, GameAthlete } from './types'

interface GameCardExpandedProps {
  game: Game
  allGames: Game[]
  onClick?: () => void
}

function Linescore({ game }: { game: Game }) {
  if (game.linescores.length === 0) return null

  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full text-xs text-text-secondary">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-1 pr-3 font-medium">Team</th>
            {game.linescores.map((_, i) => (
              <th key={i} className="px-1.5 py-1 font-medium text-center">
                {i + 1}
              </th>
            ))}
            <th className="pl-2 py-1 font-bold text-center">T</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="py-1 pr-3 font-medium text-text-primary">{game.away.abbreviation}</td>
            {game.linescores.map((ls, i) => (
              <td key={i} className="px-1.5 py-1 text-center">{ls.awayScore}</td>
            ))}
            <td className="pl-2 py-1 font-bold text-center text-text-primary">{game.away.score}</td>
          </tr>
          <tr>
            <td className="py-1 pr-3 font-medium text-text-primary">{game.home.abbreviation}</td>
            {game.linescores.map((ls, i) => (
              <td key={i} className="px-1.5 py-1 text-center">{ls.homeScore}</td>
            ))}
            <td className="pl-2 py-1 font-bold text-center text-text-primary">{game.home.score}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
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

      {/* Situation (MLB live) */}
      {isLive && game.situation && (
        <div className="text-xs text-text-secondary mt-1 text-center">{game.situation}</div>
      )}

      {/* Linescore (live + final) */}
      {(isLive || isFinal) && <Linescore game={game} />}

      {/* Leaders (live + final) */}
      {(isLive || isFinal) && <LeadersList leaders={game.allLeaders ?? game.leaders} />}

      {/* Athletes (upcoming: probable pitchers, final: featured) */}
      {game.athletes.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-medium text-text-secondary mb-1">
            {isUpcoming ? 'Probable Pitchers' : 'Notable'}
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

      {/* Upcoming schedule (when this game is upcoming or there's room) */}
      {isUpcoming && <UpcomingSchedule games={allGames} currentGameId={game.id} />}

      {/* AI Preview placeholder — wired in Task 10 */}
    </div>
  )
}

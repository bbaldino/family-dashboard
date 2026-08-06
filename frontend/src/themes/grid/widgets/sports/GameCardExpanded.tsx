import { formatUpcomingTime, type Game, type GameAthlete, type Leader } from '@/integrations/sports'
import { AiPreview } from './AiPreview'
import { AiFinalRecap } from './AiFinalRecap'
import { MlbSituation } from './MlbSituation'
import { MlbLinescore } from './MlbLinescore'
import { NbaLinescore } from './NbaLinescore'
import { LastPlayBar } from './LastPlayBar'
import { GameHeadline } from './GameHeadline'
import { MlbLiveCard } from './MlbLiveCard'

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
  const upcoming = games.filter((g) => g.id !== currentGameId && g.state === 'upcoming').slice(0, 3)

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
              <span>
                {g.away.abbreviation} vs {g.home.abbreviation}
              </span>
              <span>
                {day} {time}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AthleteCard({ athlete }: { athlete: GameAthlete }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {athlete.headshotUrl ? (
        <img
          src={athlete.headshotUrl}
          alt={athlete.name}
          className="w-12 h-12 rounded-full object-cover bg-bg-primary border border-border flex-shrink-0"
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-bg-primary border border-border flex-shrink-0" />
      )}
      <div className="min-w-0">
        <div className="text-xs font-semibold text-text-primary truncate">{athlete.name}</div>
        <div className="text-[11px] text-text-secondary truncate">
          {athlete.stats ?? athlete.role}
        </div>
      </div>
    </div>
  )
}

function ProbableAthletes({ athletes, game }: { athletes: GameAthlete[]; game: Game }) {
  const away = athletes.filter((a) => a.team === 'away')
  const home = athletes.filter((a) => a.team === 'home')
  const teamless = athletes.filter((a) => a.team == null)

  // Fallback to single list if no team info available (non-MLB or older data)
  if (away.length === 0 && home.length === 0) {
    return (
      <div className="mt-3">
        <div className="text-xs font-medium text-text-secondary mb-1">
          {game.league === 'mlb' ? 'Probable Pitchers' : 'Notable'}
        </div>
        <div className="space-y-1">
          {teamless.map((a, i) => (
            <AthleteCard key={i} athlete={a} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3">
      <div className="text-xs font-medium text-text-secondary mb-1">
        {game.league === 'mlb' ? 'Probable Pitchers' : 'Notable'}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <div className="text-[10px] text-text-muted font-semibold">{game.away.abbreviation}</div>
          {away.map((a, i) => (
            <AthleteCard key={i} athlete={a} />
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-[10px] text-text-muted font-semibold">{game.home.abbreviation}</div>
          {home.map((a, i) => (
            <AthleteCard key={i} athlete={a} />
          ))}
        </div>
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
  const hasMlbLiveCard = isLive && game.league === 'mlb' && !!game.liveDetail

  return (
    <div className="cursor-pointer" onClick={onClick}>
      {/* Upcoming: date/time above the matchup so it doesn't crush the center block */}
      {isUpcoming && (
        <div className="text-center text-xs text-text-secondary mb-1">
          {formatUpcomingTime(game.startTime)}
        </div>
      )}

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
          {isLive || isFinal ? (
            <div className="text-lg font-bold text-text-primary">
              {game.away.score} - {game.home.score}
            </div>
          ) : (
            <div className="text-xs text-text-secondary">vs</div>
          )}
          {isLive && <div className="text-xs text-error font-medium">{game.periodLabel}</div>}
          {isFinal && <div className="text-xs text-text-secondary">Final</div>}
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-sm font-bold text-text-primary">{game.home.name}</div>
            <div className="text-xs text-text-secondary">{game.home.record}</div>
          </div>
          {game.home.logo && <img src={game.home.logo} alt="" className="w-8 h-8 object-contain" />}
        </div>
      </div>

      {/* Live MLB: full live card (situation, linescore, plays, leaders) */}
      {hasMlbLiveCard && game.liveDetail && <MlbLiveCard game={game} detail={game.liveDetail} />}

      {/* Live: sport-specific situation */}
      {isLive && !hasMlbLiveCard && game.situation?.type === 'mlb' && (
        <MlbSituation situation={game.situation} />
      )}

      {/* Live: last play */}
      {isLive && !hasMlbLiveCard && game.lastPlay && <LastPlayBar text={game.lastPlay} />}

      {/* Live + Final: sport-specific linescore */}
      {(isLive || isFinal) && !hasMlbLiveCard && <SportLinescore game={game} />}

      {/* Live + Final: leaders */}
      {(isLive || isFinal) && !hasMlbLiveCard && (
        <LeadersList leaders={game.allLeaders ?? game.leaders} />
      )}

      {/* Final: ESPN recap headline if published, else LLM-generated fallback */}
      {isFinal && game.headline && <GameHeadline text={game.headline} />}
      {isFinal && !game.headline && <AiFinalRecap gameId={game.id} />}

      {/* Upcoming: athletes (probable pitchers, etc) */}
      {isUpcoming && game.athletes.length > 0 && (
        <ProbableAthletes athletes={game.athletes} game={game} />
      )}

      {/* Upcoming: broadcast info */}
      {isUpcoming && game.broadcast && (
        <div className="mt-2 text-xs text-text-muted">{game.broadcast}</div>
      )}

      {/* Upcoming: schedule + AI preview */}
      {isUpcoming && <UpcomingSchedule games={allGames} currentGameId={game.id} />}
      {isUpcoming && <AiPreview gameId={game.id} />}
    </div>
  )
}

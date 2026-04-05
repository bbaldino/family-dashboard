import type { Game } from './types'

function formatRelativeTime(startTime: string): string {
  const start = new Date(startTime)
  const now = new Date()
  const diffHours = (now.getTime() - start.getTime()) / (1000 * 60 * 60)

  if (diffHours < 1) return 'Just now'
  if (diffHours < 12) return `${Math.round(diffHours)}h ago`
  if (diffHours < 24) return 'Earlier today'
  return 'Yesterday'
}

function formatUpcomingTime(startTime: string): string {
  const start = new Date(startTime)
  const now = new Date()
  const diffHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60)

  const timeStr = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  if (diffHours < 0) return timeStr
  if (diffHours < 12) return `Today ${timeStr}`

  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (start.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow ${timeStr}`
  }

  return `${start.toLocaleDateString([], { weekday: 'short' })} ${timeStr}`
}

export function GameCard({ game, onClick }: { game: Game; onClick?: () => void }) {
  const isLive = game.state === 'live'
  const isFinal = game.state === 'final'
  const isPostponed = game.state === 'postponed'

  return (
    <div
      className={`py-[10px] border-b border-border last:border-b-0 cursor-pointer hover:bg-bg-card-hover transition-colors rounded-lg ${
        isLive ? 'bg-role-error/[3%] px-[10px] -mx-[10px]' : ''
      }`}
      onClick={onClick}
    >
      {/* League label */}
      <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.3px] mb-[6px]">
        {game.league.toUpperCase()}
        {isFinal && ` · ${formatRelativeTime(game.startTime)}`}
      </div>

      {/* Matchup row */}
      <div className="flex items-center gap-[10px]">
        {/* Away team (left) */}
        <div className="flex items-center gap-2 flex-1">
          <img
            src={game.away.logo}
            alt={game.away.abbreviation}
            className="w-9 h-9 object-contain"
          />
          <div>
            <div className={`text-[15px] font-semibold ${
              isFinal && game.away.winner === false ? 'text-text-disabled' : 'text-text-primary'
            }`}>
              {game.away.name}
            </div>
            {game.away.record && (
              <div className="text-[11px] text-text-muted">{game.away.record}</div>
            )}
          </div>
        </div>

        {/* Center block */}
        <div className="text-center min-w-[70px]">
          {(isLive || isFinal) && game.away.score != null && game.home.score != null && (
            <div className="text-[24px] font-bold tracking-[2px]">
              <span className={game.away.winner === false ? 'text-text-disabled' : 'text-text-primary'}>
                {game.away.score}
              </span>
              <span className="text-text-disabled mx-[2px]">-</span>
              <span className={game.home.winner === false ? 'text-text-disabled' : 'text-text-primary'}>
                {game.home.score}
              </span>
            </div>
          )}

          {isLive && (
            <>
              <div className="inline-flex items-center gap-1 text-[10px] font-bold text-error uppercase">
                <span className="w-[6px] h-[6px] rounded-full bg-error animate-pulse" />
                LIVE
              </div>
              {game.periodLabel && (
                <div className="text-[13px] font-semibold text-text-primary mt-[2px]">
                  {game.periodLabel}
                </div>
              )}
            </>
          )}

          {isFinal && (
            <div className="text-[11px] font-semibold text-success uppercase">Final</div>
          )}

          {game.state === 'upcoming' && (
            <>
              <div className="text-[13px] font-semibold text-palette-1">
                {formatUpcomingTime(game.startTime)}
              </div>
              {game.broadcast && (
                <div className="text-[10px] text-text-muted mt-[1px]">{game.broadcast}</div>
              )}
            </>
          )}

          {isPostponed && (
            <div className="text-[13px] font-semibold text-error">Postponed</div>
          )}
        </div>

        {/* Home team (right) */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          <div className="text-right">
            <div className={`text-[15px] font-semibold ${
              isFinal && game.home.winner === false ? 'text-text-disabled' : 'text-text-primary'
            }`}>
              {game.home.name}
            </div>
            {game.home.record && (
              <div className="text-[11px] text-text-muted">{game.home.record}</div>
            )}
          </div>
          <img
            src={game.home.logo}
            alt={game.home.abbreviation}
            className="w-9 h-9 object-contain"
          />
        </div>
      </div>

      {/* Stats / situation */}
      {(isLive || isFinal) && game.leaders.length > 0 && (
        <div className="mt-[6px] pt-[6px] border-t border-border-subtle">
          {game.leaders.map((leader, i) => (
            <div key={i} className="text-[11px] text-text-muted flex items-center gap-1">
              <span className="font-medium text-text-secondary">{leader.name}:</span>
              {leader.stats}
            </div>
          ))}
          {isLive && game.situation?.type === 'mlb' && (
            <div className="text-[11px] text-text-muted mt-[2px]">
              {game.situation.outs} {game.situation.outs === 1 ? 'out' : 'outs'}
              {(game.situation.onFirst || game.situation.onSecond || game.situation.onThird) && ' · '}
              {[
                game.situation.onFirst && '1st',
                game.situation.onSecond && '2nd',
                game.situation.onThird && '3rd',
              ].filter(Boolean).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

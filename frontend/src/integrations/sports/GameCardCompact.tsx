import type { Game } from './types'

interface GameCardCompactProps {
  game: Game
  onClick?: () => void
}

function formatTime(game: Game): string {
  if (game.state === 'live') {
    return game.periodLabel ?? 'Live'
  }
  if (game.state === 'final') {
    return 'Final'
  }
  const d = new Date(game.startTime)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { weekday: 'short' }) + ' ' +
    d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function GameCardCompact({ game, onClick }: GameCardCompactProps) {
  const hasScore = game.state === 'live' || game.state === 'final'
  const isLive = game.state === 'live'

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-bg-primary transition-colors text-xs"
    >
      {isLive && (
        <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse flex-shrink-0" />
      )}
      <span className="font-medium text-text-primary truncate flex-1">
        {game.away.abbreviation}
        {hasScore ? ` ${game.away.score}` : ''}
        {' vs '}
        {game.home.abbreviation}
        {hasScore ? ` ${game.home.score}` : ''}
      </span>
      <span className="text-text-secondary flex-shrink-0">
        {formatTime(game)}
      </span>
    </button>
  )
}

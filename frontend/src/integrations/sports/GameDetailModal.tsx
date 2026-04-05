import { Modal } from '@/ui/Modal'
import type { Game } from './types'
import { MlbSituation } from './MlbSituation'

function formatGameTime(startTime: string): string {
  const d = new Date(startTime)
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function GameDetailModal({ game, onClose }: { game: Game | null; onClose: () => void }) {
  if (!game) return null

  const isLive = game.state === 'live'
  const isFinal = game.state === 'final'
  const hasScore = isLive || isFinal

  return (
    <Modal isOpen={!!game} onClose={onClose} title={game.league.toUpperCase()}>
      <div className="space-y-4">
        {/* Matchup header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <img src={game.away.logo} alt={game.away.abbreviation} className="w-10 h-10 object-contain" />
            <div>
              <div className="text-[15px] font-semibold text-text-primary">{game.away.name}</div>
              {game.away.record && <div className="text-[11px] text-text-muted">{game.away.record}</div>}
            </div>
          </div>
          <div className="text-center min-w-[60px]">
            {hasScore && game.away.score != null && game.home.score != null ? (
              <div className="text-[28px] font-bold tracking-[2px]">
                <span className={isFinal && game.away.winner === false ? 'text-text-disabled' : ''}>{game.away.score}</span>
                <span className="text-text-disabled mx-1">-</span>
                <span className={isFinal && game.home.winner === false ? 'text-text-disabled' : ''}>{game.home.score}</span>
              </div>
            ) : (
              <div className="text-[13px] text-text-muted">vs</div>
            )}
            {isLive && game.periodLabel && (
              <div className="text-[12px] font-semibold text-error">{game.periodLabel}</div>
            )}
            {isFinal && <div className="text-[11px] font-semibold text-success uppercase">Final</div>}
          </div>
          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className="text-right">
              <div className="text-[15px] font-semibold text-text-primary">{game.home.name}</div>
              {game.home.record && <div className="text-[11px] text-text-muted">{game.home.record}</div>}
            </div>
            <img src={game.home.logo} alt={game.home.abbreviation} className="w-10 h-10 object-contain" />
          </div>
        </div>

        {/* Linescore table */}
        {game.linescores.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-text-muted">
                  <th className="text-left font-semibold py-1 pr-2"></th>
                  {game.linescores.map((ls) => (
                    <th key={ls.period} className="text-center font-semibold py-1 px-1 min-w-[20px]">
                      {ls.period}
                    </th>
                  ))}
                  <th className="text-center font-bold py-1 pl-2 border-l border-border">T</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-semibold text-text-primary py-1 pr-2">{game.away.abbreviation}</td>
                  {game.linescores.map((ls) => (
                    <td key={ls.period} className="text-center text-text-secondary py-1 px-1">{ls.awayScore}</td>
                  ))}
                  <td className="text-center font-bold text-text-primary py-1 pl-2 border-l border-border">
                    {game.away.score ?? '-'}
                  </td>
                </tr>
                <tr>
                  <td className="font-semibold text-text-primary py-1 pr-2">{game.home.abbreviation}</td>
                  {game.linescores.map((ls) => (
                    <td key={ls.period} className="text-center text-text-secondary py-1 px-1">{ls.homeScore}</td>
                  ))}
                  <td className="text-center font-bold text-text-primary py-1 pl-2 border-l border-border">
                    {game.home.score ?? '-'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Situation (MLB live) */}
        {isLive && game.situation?.type === 'mlb' && (
          <MlbSituation situation={game.situation} />
        )}

        {/* Leaders */}
        {game.allLeaders.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.3px] mb-2">
              Leaders
            </div>
            <div className="space-y-1">
              {game.allLeaders.map((leader, i) => (
                <div key={i} className="flex items-center gap-2 text-[12px]">
                  <span className="font-medium text-text-primary">{leader.name}</span>
                  <span className="text-text-muted">{leader.stats}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Probables / Featured athletes */}
        {game.athletes.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.3px] mb-2">
              {game.state === 'upcoming' ? 'Probable Pitchers' : 'Pitchers'}
            </div>
            <div className="space-y-1">
              {game.athletes.map((athlete, i) => (
                <div key={i} className="flex items-center gap-2 text-[12px]">
                  <span className="font-medium text-text-primary">{athlete.name}</span>
                  {athlete.role && <span className="text-[10px] text-text-muted">({athlete.role})</span>}
                  {athlete.stats && <span className="text-text-muted">{athlete.stats}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Game info */}
        <div className="text-[11px] text-text-muted space-y-0.5 pt-1 border-t border-border">
          {game.venue && <div>{game.venue}</div>}
          {game.broadcast && <div>TV: {game.broadcast}</div>}
          {game.state === 'upcoming' && <div>{formatGameTime(game.startTime)}</div>}
          {game.playoffRound && <div className="font-semibold text-text-secondary">{game.playoffRound}</div>}
        </div>

        {/* ESPN link */}
        {game.espnUrl && (
          <a
            href={game.espnUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-[12px] text-info hover:underline"
          >
            View on ESPN
          </a>
        )}
      </div>
    </Modal>
  )
}

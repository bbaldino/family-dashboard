import type { Game } from './types'

interface MlbLinescoreProps {
  game: Game
}

export function MlbLinescore({ game }: MlbLinescoreProps) {
  if (game.linescores.length === 0) return null

  const currentPeriod = game.period

  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full text-xs text-text-secondary">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-1 pr-3 font-medium" />
            {game.linescores.map((_, i) => (
              <th
                key={i}
                className={`px-1.5 py-1 font-medium text-center ${
                  currentPeriod != null && i + 1 === currentPeriod ? 'text-palette-6' : ''
                }`}
              >
                {i + 1}
              </th>
            ))}
            <th className="pl-2 py-1 font-bold text-center">R</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="py-1 pr-3 font-medium text-text-primary">{game.away.abbreviation}</td>
            {game.linescores.map((ls, i) => (
              <td
                key={i}
                className={`px-1.5 py-1 text-center ${
                  currentPeriod != null && i + 1 === currentPeriod ? 'text-palette-6' : ''
                }`}
              >
                {ls.awayScore}
              </td>
            ))}
            <td className="pl-2 py-1 font-bold text-center text-text-primary">{game.away.score}</td>
          </tr>
          <tr>
            <td className="py-1 pr-3 font-medium text-text-primary">{game.home.abbreviation}</td>
            {game.linescores.map((ls, i) => (
              <td
                key={i}
                className={`px-1.5 py-1 text-center ${
                  currentPeriod != null && i + 1 === currentPeriod ? 'text-palette-6' : ''
                }`}
              >
                {ls.homeScore}
              </td>
            ))}
            <td className="pl-2 py-1 font-bold text-center text-text-primary">{game.home.score}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

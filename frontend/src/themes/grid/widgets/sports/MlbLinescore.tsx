import type { Game } from '@/integrations/sports'

interface MlbLinescoreProps {
  game: Game
}

const MIN_INNINGS = 9

export function MlbLinescore({ game }: MlbLinescoreProps) {
  // Render even when no innings have been played yet (pre-game and start
  // of game both benefit from showing the empty 9-column grid).
  const inningsPlayed = game.linescores.length
  const columns = Math.max(MIN_INNINGS, inningsPlayed)
  const currentPeriod = game.period

  const formatCell = (val: string | undefined) => (val == null || val === '' ? '·' : val)
  const formatTotal = (val: number | null | undefined) => (val == null ? '·' : String(val))

  const isCurrent = (i: number) => currentPeriod != null && i + 1 === currentPeriod

  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full text-xs text-text-secondary">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-1 pr-3 font-medium" />
            {Array.from({ length: columns }, (_, i) => (
              <th
                key={i}
                className={`px-1.5 py-1 font-medium text-center ${
                  isCurrent(i) ? 'text-palette-6' : ''
                }`}
              >
                {i + 1}
              </th>
            ))}
            <th className="pl-3 py-1 font-bold text-center text-text-primary">R</th>
            <th className="px-1.5 py-1 font-bold text-center text-text-primary">H</th>
            <th className="px-1.5 py-1 font-bold text-center text-text-primary">E</th>
          </tr>
        </thead>
        <tbody>
          {(['away', 'home'] as const).map((side) => {
            const team = game[side]
            return (
              <tr key={side}>
                <td className="py-1 pr-3 font-medium text-text-primary">{team.abbreviation}</td>
                {Array.from({ length: columns }, (_, i) => (
                  <td
                    key={i}
                    className={`px-1.5 py-1 text-center ${isCurrent(i) ? 'text-palette-6' : ''}`}
                  >
                    {formatCell(game.linescores[i]?.[`${side}Score` as 'awayScore' | 'homeScore'])}
                  </td>
                ))}
                <td className="pl-3 py-1 font-bold text-center text-text-primary">
                  {formatTotal(team.score)}
                </td>
                <td className="px-1.5 py-1 text-center text-text-primary">
                  {formatTotal(team.hits)}
                </td>
                <td className="px-1.5 py-1 text-center text-text-primary">
                  {formatTotal(team.errors)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

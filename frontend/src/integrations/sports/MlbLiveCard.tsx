import type { Game, GameLiveDetail } from './types'
import { BaseDiamond } from './BaseDiamond'
import { CountIndicator } from './CountIndicator'
import { WinProbabilityBar } from './WinProbabilityBar'
import { PitcherBatterMatchup } from './PitcherBatterMatchup'
import { PitchSequence } from './PitchSequence'
import { PlayByPlayLog } from './PlayByPlayLog'
import { ScoringSummary } from './ScoringSummary'
import { GameLeaders } from './GameLeaders'
import { MlbLinescore } from './MlbLinescore'

interface MlbLiveCardProps {
  game: Game
  detail: GameLiveDetail
}

export function MlbLiveCard({ game, detail }: MlbLiveCardProps) {
  const mlbSituation = game.situation?.type === 'mlb' ? game.situation : null
  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Inning header */}
      {game.periodLabel && (
        <div className="text-[14px] text-text-muted">{game.periodLabel}</div>
      )}

      {detail.winProbability && (
        <WinProbabilityBar
          win={detail.winProbability}
          homeAbbr={game.home.abbreviation}
          awayAbbr={game.away.abbreviation}
        />
      )}

      {/* Situation: diamond + B/S/O + matchup, all in one row */}
      {(mlbSituation || detail.matchup) && (
        <div className="flex items-center gap-4 py-2 px-3 bg-bg-primary/50 rounded-lg">
          {mlbSituation && (
            <>
              <BaseDiamond
                onFirst={mlbSituation.onFirst}
                onSecond={mlbSituation.onSecond}
                onThird={mlbSituation.onThird}
                size={80}
              />
              <div className="flex flex-col gap-1">
                <CountIndicator
                  label="B"
                  filled={mlbSituation.balls ?? 0}
                  total={4}
                  color="bg-success"
                  dotSize={12}
                />
                <CountIndicator
                  label="S"
                  filled={mlbSituation.strikes ?? 0}
                  total={3}
                  color="bg-error"
                  dotSize={12}
                />
                <CountIndicator
                  label="O"
                  filled={mlbSituation.outs}
                  total={3}
                  color="bg-warning"
                  dotSize={12}
                />
              </div>
            </>
          )}
          {detail.matchup && (
            <div className="flex-1 min-w-0">
              <PitcherBatterMatchup matchup={detail.matchup} />
            </div>
          )}
        </div>
      )}

      <PitchSequence pitches={detail.pitchSequence} />

      <MlbLinescore game={game} />

      <ScoringSummary plays={detail.scoringPlays} />

      <PlayByPlayLog plays={detail.recentPlays} />

      <GameLeaders
        leaders={detail.leaders}
        homeAbbr={game.home.abbreviation}
        awayAbbr={game.away.abbreviation}
      />
    </div>
  )
}

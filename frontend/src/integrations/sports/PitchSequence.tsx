import type { Pitch } from './types'

interface PitchSequenceProps {
  pitches: Pitch[]
}

const pitchColor: Record<Pitch['kind'], string> = {
  ball: 'bg-success',
  called_strike: 'bg-error',
  swinging_strike: 'bg-error',
  foul: 'bg-amber-500',
  in_play: 'bg-sky-500',
}

const pitchLabel: Record<Pitch['kind'], string> = {
  ball: 'B',
  called_strike: 'K',
  swinging_strike: 'K',
  foul: 'F',
  in_play: 'X',
}

export function PitchSequence({ pitches }: PitchSequenceProps) {
  if (pitches.length === 0) return null
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-text-muted">At-bat:</span>
      {pitches.map((pitch, i) => (
        <span
          key={i}
          className={`w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center ${pitchColor[pitch.kind]}`}
          title={`${pitch.pitchType ?? ''} ${pitch.speedMph ? pitch.speedMph + ' mph' : ''}`.trim()}
        >
          {pitchLabel[pitch.kind]}
        </span>
      ))}
    </div>
  )
}

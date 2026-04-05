import { useState, useCallback } from 'react'
import { WidgetCard } from '@/ui/WidgetCard'
import { useTrivia } from './useTrivia'

const LETTERS = ['A', 'B', 'C', 'D']

export function TriviaWidget() {
  const { data, isLoading, error } = useTrivia()
  const [revealed, setRevealed] = useState(false)

  const handleTap = useCallback(() => {
    setRevealed((prev) => !prev)
  }, [])

  if (isLoading || error || !data) {
    return (
      <WidgetCard title="Trivia" category="info">
        <div className="text-text-muted text-sm">
          {isLoading ? 'Loading...' : 'Unable to load'}
        </div>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title="Trivia" category="info">
      <div className="flex flex-col gap-2 h-full cursor-pointer" onClick={handleTap}>
        <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.3px]">
          {data.category}
        </div>
        <p className="text-sm text-text-primary leading-relaxed">{data.question}</p>
        <div className="grid grid-cols-2 gap-1.5 mt-auto">
          {data.choices.map((choice, i) => {
            const isCorrect = i === data.correctIndex
            let className =
              'text-xs px-2 py-1.5 rounded border text-left transition-colors '
            if (revealed) {
              className += isCorrect
                ? 'border-success bg-success/10 text-success font-medium'
                : 'border-border text-text-muted opacity-50'
            } else {
              className += 'border-border text-text-primary hover:bg-bg-card-hover'
            }
            return (
              <div key={i} className={className}>
                <span className="font-medium text-text-muted mr-1">{LETTERS[i]}.</span>
                {choice}
              </div>
            )
          })}
        </div>
        {!revealed && (
          <div className="text-[10px] text-text-muted text-center">Tap to reveal answer</div>
        )}
      </div>
    </WidgetCard>
  )
}

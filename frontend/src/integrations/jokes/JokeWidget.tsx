import { useState, useCallback } from 'react'
import { WidgetCard } from '@/ui/WidgetCard'
import { useJoke } from './useJoke'

export function JokeWidget() {
  const { data, isLoading, error } = useJoke()
  const [revealed, setRevealed] = useState(false)

  const handleTap = useCallback(() => {
    setRevealed((prev) => !prev)
  }, [])

  if (isLoading || error || !data) {
    return (
      <WidgetCard title="Joke of the Day" category="info">
        <div className="text-text-muted text-sm">
          {isLoading ? 'Loading...' : 'Unable to load'}
        </div>
      </WidgetCard>
    )
  }

  if (data.type === 'single') {
    return (
      <WidgetCard title="Joke of the Day" category="info">
        <p className="text-sm text-text-primary leading-relaxed">{data.joke}</p>
      </WidgetCard>
    )
  }

  // Two-part joke: setup visible, delivery on tap
  return (
    <WidgetCard title="Joke of the Day" category="info">
      <div className="flex flex-col gap-2 h-full cursor-pointer" onClick={handleTap}>
        <p className="text-sm text-text-primary leading-relaxed">{data.setup}</p>
        {revealed ? (
          <p className="text-sm text-palette-3 font-medium leading-relaxed">{data.delivery}</p>
        ) : (
          <div className="text-[10px] text-text-muted text-center mt-auto">Tap to reveal punchline</div>
        )}
      </div>
    </WidgetCard>
  )
}

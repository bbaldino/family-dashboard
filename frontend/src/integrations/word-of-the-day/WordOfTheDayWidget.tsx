import { WidgetCard } from '@/ui/WidgetCard'
import { useWordOfTheDay } from './useWordOfTheDay'

export function WordOfTheDayWidget() {
  const { data, isLoading, error } = useWordOfTheDay()

  if (isLoading || error || !data) {
    return (
      <WidgetCard title="Word of the Day" category="info">
        <div className="text-text-muted" style={{ fontSize: '3.5cqi' }}>
          {isLoading ? 'Loading...' : 'Unable to load'}
        </div>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title="Word of the Day" category="info">
      <div className="flex flex-col h-full justify-center" style={{ gap: 'min(2cqi, 12px)' }}>
        <div>
          <span className="font-bold text-palette-3" style={{ fontSize: 'min(6cqi, 36px)' }}>{data.word}</span>
          {data.partOfSpeech && (
            <span className="text-text-muted italic" style={{ fontSize: 'min(2.8cqi, 16px)', marginLeft: 'min(1.5cqi, 10px)' }}>{data.partOfSpeech}</span>
          )}
        </div>
        <p className="text-text-primary leading-relaxed" style={{ fontSize: 'min(3cqi, 18px)' }}>{data.definition}</p>
        {data.example && (
          <p className="text-text-muted italic mt-auto leading-relaxed" style={{ fontSize: 'min(2.8cqi, 16px)' }}>
            "{data.example}"
          </p>
        )}
      </div>
    </WidgetCard>
  )
}

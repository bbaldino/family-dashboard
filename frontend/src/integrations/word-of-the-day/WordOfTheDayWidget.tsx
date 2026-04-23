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
      <div className="flex flex-col h-full justify-center" style={{ gap: '2cqi' }}>
        <div>
          <span className="font-bold text-palette-3" style={{ fontSize: '6cqi' }}>{data.word}</span>
          {data.partOfSpeech && (
            <span className="text-text-muted italic" style={{ fontSize: '2.8cqi', marginLeft: '1.5cqi' }}>{data.partOfSpeech}</span>
          )}
        </div>
        <p className="text-text-primary leading-relaxed" style={{ fontSize: '3cqi' }}>{data.definition}</p>
        {data.example && (
          <p className="text-text-muted italic mt-auto leading-relaxed" style={{ fontSize: '2.8cqi' }}>
            "{data.example}"
          </p>
        )}
      </div>
    </WidgetCard>
  )
}

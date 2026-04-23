import { WidgetCard } from '@/ui/WidgetCard'
import { useWordOfTheDay } from './useWordOfTheDay'

export function WordOfTheDayWidget() {
  const { data, isLoading, error } = useWordOfTheDay()

  if (isLoading || error || !data) {
    return (
      <WidgetCard title="Word of the Day" category="info">
        <div className="text-text-muted text-sm">
          {isLoading ? 'Loading...' : 'Unable to load'}
        </div>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title="Word of the Day" category="info">
      <div className="flex flex-col gap-2 h-full justify-center">
        <div>
          <span className="text-3xl font-bold text-palette-3">{data.word}</span>
          {data.partOfSpeech && (
            <span className="text-sm text-text-muted italic ml-2">{data.partOfSpeech}</span>
          )}
        </div>
        <p className="text-[15px] text-text-primary leading-relaxed">{data.definition}</p>
        {data.example && (
          <p className="text-[13px] text-text-muted italic mt-auto leading-relaxed">
            "{data.example}"
          </p>
        )}
      </div>
    </WidgetCard>
  )
}

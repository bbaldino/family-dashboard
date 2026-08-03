import { WidgetCard } from '@/themes/grid/ui/WidgetCard'
import { useDailyQuote } from '@/data/daily-quote'

export function DailyQuoteWidget() {
  const { data, isLoading, error } = useDailyQuote()

  if (isLoading || error || !data) {
    return (
      <WidgetCard title="Daily Quote" category="info">
        <div className="text-text-muted text-sm">{isLoading ? 'Loading...' : 'Unable to load'}</div>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title="Daily Quote" category="info">
      <div className="flex flex-col gap-2 h-full">
        <p className="text-sm text-text-primary italic leading-relaxed flex-1">"{data.quote}"</p>
        <p className="text-xs text-text-muted text-right">— {data.author}</p>
      </div>
    </WidgetCard>
  )
}

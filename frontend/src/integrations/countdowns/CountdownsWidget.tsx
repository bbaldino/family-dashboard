import { WidgetCard } from '@/ui/WidgetCard'
import { LoadingSpinner } from '@/ui/LoadingSpinner'
import { useCountdowns } from './useCountdowns'

function formatDays(days: number): string {
  if (days === 0) return 'Today!'
  if (days === 1) return '1 day'
  return `${days} days`
}

export function CountdownsWidget() {
  const { data, isLoading, error } = useCountdowns()

  if (isLoading) {
    return (
      <WidgetCard title="Coming Up" category="info">
        <LoadingSpinner />
      </WidgetCard>
    )
  }

  if (error) {
    return (
      <WidgetCard title="Coming Up" category="info">
        <div className="text-[13px] text-text-muted">Configure countdown calendar in settings</div>
      </WidgetCard>
    )
  }

  const items = data ?? []

  return (
    <WidgetCard title="Coming Up" category="info">
      {items.length === 0 ? (
        <div className="text-[13px] text-text-muted py-1">Nothing coming up</div>
      ) : (
        <div className="flex flex-col">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-[5px] border-b border-border last:border-b-0"
            >
              <span className="text-[14px] text-text-primary truncate mr-2">
                {item.name}
              </span>
              <span
                className={`text-[16px] font-semibold whitespace-nowrap ${
                  item.daysUntil === 0 ? 'text-success' : 'text-info'
                }`}
              >
                {formatDays(item.daysUntil)}
              </span>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  )
}

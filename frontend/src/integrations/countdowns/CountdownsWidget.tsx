import { WidgetCard } from '@/ui/WidgetCard'
import { LoadingSpinner } from '@/ui/LoadingSpinner'
import { useCountdowns } from './useCountdowns'
type WidgetSize = 'compact' | 'standard' | 'expanded'

function formatDays(days: number): string {
  if (days === 0) return 'Today!'
  if (days === 1) return '1 day'
  return `${days} days`
}

interface CountdownsWidgetProps {
  size?: WidgetSize
}

export function CountdownsWidget({ size = 'standard' }: CountdownsWidgetProps) {
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

  if (size === 'compact') {
    return (
      <WidgetCard
        title="Coming Up"
        category="info"
        detail={
          items.length > 0 ? (
            <div className="flex flex-col">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-[5px] border-b border-border last:border-b-0"
                >
                  <span className="text-[14px] text-text-primary truncate mr-2">{item.name}</span>
                  <span className={`text-[16px] font-semibold whitespace-nowrap ${item.daysUntil === 0 ? 'text-success' : 'text-info'}`}>
                    {formatDays(item.daysUntil)}
                  </span>
                </div>
              ))}
            </div>
          ) : undefined
        }
      >
        <div className="flex flex-col">
          {items.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-1 text-xs"
            >
              <span className="text-text-primary truncate mr-2">{item.name}</span>
              <span className={`font-semibold whitespace-nowrap ${item.daysUntil === 0 ? 'text-success' : 'text-info'}`}>
                {formatDays(item.daysUntil)}
              </span>
            </div>
          ))}
        </div>
      </WidgetCard>
    )
  }

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

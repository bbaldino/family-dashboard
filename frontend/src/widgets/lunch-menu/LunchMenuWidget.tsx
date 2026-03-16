import { LoadingSpinner } from '@/ui/LoadingSpinner'
import { ErrorDisplay } from '@/ui/ErrorDisplay'
import { WidgetCard } from '@/ui/WidgetCard'
import { useLunchMenu, todayDayName, isWeekday } from './useLunchMenu'

export function LunchMenuWidget() {
  const { data, isLoading, error, refetch } = useLunchMenu()

  const todayName = todayDayName()
  const todayMenu = data?.days.find(
    (d) => d.day.toLowerCase() === todayName.toLowerCase(),
  )

  if (isLoading) {
    return (
      <WidgetCard title="Lunch Menu" category="food" visible={isWeekday()}>
        <LoadingSpinner />
      </WidgetCard>
    )
  }

  if (error) {
    return (
      <WidgetCard title="Lunch Menu" category="food" visible={isWeekday()}>
        <ErrorDisplay message={error} onRetry={refetch} />
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title="Lunch Menu" category="food" visible={isWeekday()}>
      {todayMenu && todayMenu.items.length > 0 ? (
        <ul className="flex flex-col gap-[3px]">
          {todayMenu.items.map((item, i) => (
            <li key={i} className="text-[14px] text-text-primary">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-[14px] text-text-muted py-2">No menu for today</div>
      )}
    </WidgetCard>
  )
}

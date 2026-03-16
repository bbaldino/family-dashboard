import { LoadingSpinner } from '@/ui/LoadingSpinner'
import { ErrorDisplay } from '@/ui/ErrorDisplay'
import { WidgetCard } from '@/ui/WidgetCard'
import { useLunchMenu, isWeekday, type LunchMenuDay } from './useLunchMenu'

function MenuDaySection({ day, label }: { day: LunchMenuDay; label: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-1">
        {label}
      </div>
      <ul className="flex flex-col gap-[2px]">
        {day.items.map((item, i) => (
          <li key={i} className="text-[14px] text-text-primary">
            {item.name}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LunchMenuWidget() {
  const { data, isLoading, error, refetch } = useLunchMenu()

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

  const hasToday = data?.today != null
  const hasTomorrow = data?.tomorrow != null

  return (
    <WidgetCard title="Lunch Menu" category="food" visible={isWeekday()}>
      {hasToday ? (
        <div className="flex flex-col gap-3">
          <MenuDaySection day={data!.today!} label="Today" />
          {hasTomorrow && (
            <>
              <div className="border-t border-border" />
              <MenuDaySection day={data!.tomorrow!} label="Tomorrow" />
            </>
          )}
        </div>
      ) : hasTomorrow ? (
        <MenuDaySection day={data!.tomorrow!} label="Tomorrow" />
      ) : (
        <div className="text-[14px] text-text-muted py-2">No menu available</div>
      )}
    </WidgetCard>
  )
}

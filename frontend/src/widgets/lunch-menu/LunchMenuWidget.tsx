import { LoadingSpinner } from '@/ui/LoadingSpinner'
import { ErrorDisplay } from '@/ui/ErrorDisplay'
import { WidgetCard } from '@/ui/WidgetCard'
import { useLunchMenu, isWeekday, type LunchMenuDay } from './useLunchMenu'

function MenuDaySection({ day, label }: { day: LunchMenuDay; label: string }) {
  return (
    <div>
      <div className="text-[11px] font-bold text-food uppercase tracking-[0.5px] mb-[6px]">
        {label}
      </div>

      {/* Entree choices in tinted box */}
      {day.entrees.length > 0 && (
        <div className="bg-food/5 rounded-[10px] p-1 mb-2 flex flex-col gap-[3px]">
          {day.entrees.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-2 py-[5px] px-2 bg-white/70 rounded-lg"
            >
              <span className="w-[6px] h-[6px] rounded-full bg-food flex-shrink-0" />
              <span className="text-[15px] font-medium text-text-primary">
                {item.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Side pills */}
      {day.sides.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {day.sides.map((item, i) => (
            <span
              key={i}
              className="text-[12px] text-text-secondary bg-bg-primary px-[10px] py-[3px] rounded-lg"
            >
              {item.name}
            </span>
          ))}
        </div>
      )}
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
        <div className="flex flex-col gap-[10px]">
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

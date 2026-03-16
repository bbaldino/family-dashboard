import { LoadingSpinner } from '@/ui/LoadingSpinner'
import { ErrorDisplay } from '@/ui/ErrorDisplay'
import { WidgetCard } from '@/ui/WidgetCard'
import { useLunchMenu, isWeekday, type LunchMenuDay } from './useLunchMenu'

function MenuDaySection({
  day,
  label,
  compact = false,
}: {
  day: LunchMenuDay
  label: string
  compact?: boolean
}) {
  return (
    <div>
      <div className="text-[11px] font-bold text-food uppercase tracking-[0.5px] mb-[4px]">
        {label}
      </div>

      {/* Entree choices in tinted box */}
      {day.entrees.length > 0 && (
        <div className="bg-food/5 rounded-[8px] p-[3px] mb-[4px] flex flex-col gap-[2px]">
          {day.entrees.map((item, i) => (
            <div
              key={i}
              className={`flex items-center gap-[6px] ${compact ? 'py-[2px]' : 'py-[3px]'} px-[6px] bg-white/70 rounded-md`}
            >
              <span className="w-[5px] h-[5px] rounded-full bg-food flex-shrink-0" />
              <span
                className={`${compact ? 'text-[13px]' : 'text-[14px]'} font-medium text-text-primary`}
              >
                {item.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Side pills */}
      {day.sides.length > 0 && (
        <div className="flex flex-wrap gap-[3px]">
          {day.sides.map((item, i) => (
            <span
              key={i}
              className="text-[11px] text-text-secondary bg-bg-primary px-[8px] py-[2px] rounded-md"
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
        <div className="flex flex-col gap-[6px]">
          <MenuDaySection day={data!.today!} label="Today" />
          {hasTomorrow && (
            <>
              <div className="border-t border-border" />
              <MenuDaySection day={data!.tomorrow!} label="Tomorrow" compact />
            </>
          )}
        </div>
      ) : hasTomorrow ? (
        <MenuDaySection day={data!.tomorrow!} label="Tomorrow" />
      ) : (
        <div className="text-[13px] text-text-muted py-1">No menu available</div>
      )}
    </WidgetCard>
  )
}

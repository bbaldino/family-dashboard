import { LoadingSpinner } from '@/ui/LoadingSpinner'
import { ErrorDisplay } from '@/ui/ErrorDisplay'
import { WidgetCard } from '@/ui/WidgetCard'
import { useLunchMenu, type LunchMenuDay, type MenuEntry } from './useLunchMenu'
import type { WidgetSize } from '@/lib/widget-types'

function EntryItem({ entry, compact = false }: { entry: MenuEntry; compact?: boolean }) {
  return (
    <div className={`${compact ? 'py-[1px]' : 'py-[2px]'} ${entry.isAlternative ? 'pl-[14px]' : ''}`}>
      <div className="flex items-center gap-[6px]">
        {entry.isAlternative ? (
          <span className={`${compact ? 'text-[11px]' : 'text-[12px]'} text-palette-4 font-medium`}>or</span>
        ) : (
          <span className="w-[5px] h-[5px] rounded-full bg-palette-4 flex-shrink-0" />
        )}
        <span className={`${compact ? 'text-[13px]' : 'text-[14px]'} font-medium text-text-primary`}>
          {entry.name}
        </span>
      </div>
      {entry.withItems.length > 0 && (
        <div className="pl-[16px]">
          {entry.withItems.map((withItem, i) => (
            <span
              key={i}
              className={`${compact ? 'text-[11px]' : 'text-[12px]'} text-text-secondary italic`}
            >
              w/ {withItem}{i < entry.withItems.length - 1 ? ', ' : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

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
      <div className="text-[11px] font-bold text-palette-4 uppercase tracking-[0.5px] mb-[4px]">
        {label}
      </div>

      {/* Main entries with "with" items */}
      {day.entries.length > 0 && (
        <div className="bg-palette-4/5 rounded-[8px] p-[3px] mb-[4px]">
          {day.entries.map((entry, i) => (
            <div key={i} className="px-[6px] bg-white/70 rounded-md mb-[1px] last:mb-0">
              <EntryItem entry={entry} compact={compact} />
            </div>
          ))}
        </div>
      )}

      {/* Extras (milk, salad station) as pills */}
      {day.extras.length > 0 && (
        <div className="flex flex-wrap gap-[3px]">
          {day.extras.map((extra, i) => (
            <span
              key={i}
              className="text-[11px] text-text-secondary bg-bg-primary px-[8px] py-[2px] rounded-md"
            >
              {extra}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

interface LunchMenuWidgetProps {
  size?: WidgetSize
}

export function LunchMenuWidget({ size = 'standard' }: LunchMenuWidgetProps) {
  const { data, isLoading, error, refetch } = useLunchMenu()

  const hasToday = data?.today != null
  const hasTomorrow = data?.tomorrow != null
  const hasMenu = hasToday || hasTomorrow

  if (isLoading) {
    return (
      <WidgetCard title="Lunch Menu" category="food">
        <LoadingSpinner />
      </WidgetCard>
    )
  }

  if (error) {
    return (
      <WidgetCard title="Lunch Menu" category="food">
        <ErrorDisplay message={error} onRetry={refetch} />
      </WidgetCard>
    )
  }

  if (size === 'compact') {
    const compactDay = data?.today ?? data?.tomorrow
    const compactLabel = data?.today ? 'Today' : 'Tomorrow'
    const mainEntries = compactDay?.entries.filter((e) => !e.isAlternative) ?? []

    return (
      <WidgetCard
        title="Lunch Menu"
        category="food"
        visible={hasMenu}
        detail={
          hasToday ? (
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
          ) : undefined
        }
      >
        {compactDay && (
          <div>
            <div className="text-[10px] font-bold text-palette-4 uppercase tracking-[0.5px] mb-1">
              {compactLabel}
            </div>
            <div className="flex flex-col gap-0.5">
              {mainEntries.slice(0, 4).map((entry, i) => (
                <div key={i} className="flex items-center gap-1 text-xs">
                  <span className="w-1 h-1 rounded-full bg-palette-4 flex-shrink-0" />
                  <span className="text-text-primary truncate">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title="Lunch Menu" category="food" visible={hasMenu}>
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

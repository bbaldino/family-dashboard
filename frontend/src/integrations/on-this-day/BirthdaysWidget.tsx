import { WidgetCard } from '@/ui/WidgetCard'
import { useOnThisDay } from './useOnThisDay'

export function BirthdaysWidget() {
  const { data, isLoading } = useOnThisDay()
  const births = data?.births ?? []

  if (isLoading) {
    return (
      <WidgetCard title="Born Today" category="info">
        <div className="text-text-muted text-sm">Loading...</div>
      </WidgetCard>
    )
  }

  if (births.length === 0) {
    return (
      <WidgetCard title="Born Today" category="info">
        <div className="text-text-muted text-sm">No birthdays today</div>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title="Born Today" category="info">
      <div className="flex flex-col gap-2">
        {births.map((b, i) => (
          <div key={i} className="flex items-center gap-3">
            {b.photoUrl ? (
              <img
                src={b.photoUrl}
                alt={b.name}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-bg-primary flex items-center justify-center text-text-muted text-sm flex-shrink-0">
                {b.name[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text-primary truncate">{b.name}</div>
              <div className="text-xs text-text-muted truncate">
                {b.knownFor.length > 0 ? b.knownFor.join(', ') : b.role}
              </div>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  )
}

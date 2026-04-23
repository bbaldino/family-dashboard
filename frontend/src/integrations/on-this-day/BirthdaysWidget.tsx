import { WidgetCard } from '@/ui/WidgetCard'
import { useOnThisDay } from './useOnThisDay'

export function BirthdaysWidget() {
  const { data, isLoading } = useOnThisDay()
  const births = data?.births ?? []

  if (isLoading) {
    return (
      <WidgetCard title="Born Today" category="info">
        <div className="text-text-muted" style={{ fontSize: '3.5cqi' }}>Loading...</div>
      </WidgetCard>
    )
  }

  if (births.length === 0) {
    return (
      <WidgetCard title="Born Today" category="info">
        <div className="text-text-muted" style={{ fontSize: '3.5cqi' }}>No birthdays today</div>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title="Born Today" category="info">
      <div className="flex flex-col h-full justify-center" style={{ gap: '2cqi' }}>
        {births.map((b, i) => (
          <div key={i} className="flex items-center" style={{ gap: '2.5cqi' }}>
            {b.photoUrl ? (
              <img
                src={b.photoUrl}
                alt={b.name}
                className="rounded-full object-cover flex-shrink-0"
                style={{ width: '11cqi', height: '11cqi' }}
              />
            ) : (
              <div
                className="rounded-full bg-bg-primary flex items-center justify-center text-text-muted flex-shrink-0"
                style={{ width: '11cqi', height: '11cqi', fontSize: '4.5cqi' }}
              >
                {b.name[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-text-primary truncate" style={{ fontSize: '3.5cqi' }}>
                {b.name}
              </div>
              <div className="text-text-muted truncate" style={{ fontSize: '2.8cqi' }}>
                {b.knownFor.length > 0 ? b.knownFor.join(', ') : b.role}
              </div>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  )
}

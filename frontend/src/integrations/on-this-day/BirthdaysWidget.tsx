import { WidgetCard } from '@/ui/WidgetCard'
import { useOnThisDay } from './useOnThisDay'

export function BirthdaysWidget() {
  const { data, isLoading } = useOnThisDay()
  const births = data?.births ?? []

  if (isLoading) {
    return (
      <WidgetCard title="Born Today" category="info">
        <div className="text-text-muted" style={{ fontSize: '3cqi' }}>Loading...</div>
      </WidgetCard>
    )
  }

  if (births.length === 0) {
    return (
      <WidgetCard title="Born Today" category="info">
        <div className="text-text-muted" style={{ fontSize: '3cqi' }}>No birthdays today</div>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title="Born Today" category="info">
      <div className="flex flex-col h-full justify-center" style={{ gap: 'min(2cqi, 10px)' }}>
        {births.map((b, i) => (
          <div key={i}>
            <div className="font-semibold text-text-primary" style={{ fontSize: 'min(3.2cqi, 15px)', marginBottom: 'min(1.5cqi, 6px)' }}>
              {b.name}
            </div>
            <div className="flex items-center" style={{ gap: 'min(2.5cqi, 10px)' }}>
              {b.photoUrl ? (
                <img
                  src={b.photoUrl}
                  alt={b.name}
                  className="rounded-full object-cover flex-shrink-0"
                  style={{ width: 'min(10cqi, 48px)', height: 'min(10cqi, 48px)' }}
                />
              ) : (
                <div
                  className="rounded-full bg-bg-primary flex items-center justify-center text-text-muted flex-shrink-0"
                  style={{ width: 'min(10cqi, 48px)', height: 'min(10cqi, 48px)', fontSize: 'min(4cqi, 18px)' }}
                >
                  {b.name[0]}
                </div>
              )}
              <div className="flex-1 min-w-0 text-text-muted" style={{ fontSize: 'min(2.8cqi, 13px)' }}>
                {b.knownFor.length > 0 ? b.knownFor.join(', ') : b.role}
              </div>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  )
}

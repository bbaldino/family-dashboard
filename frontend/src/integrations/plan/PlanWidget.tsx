import { WidgetCard } from '@/ui/WidgetCard'
import { LoadingSpinner } from '@/ui/LoadingSpinner'
import { usePlanWidget } from './usePlanWidget'
import type { UpcomingPlan } from './usePlanWidget'

function planTypeIcon(planType: string): string {
  switch (planType.toLowerCase()) {
    case 'trip':
      return '\u2708'
    case 'event':
      return '\uD83C\uDF89'
    case 'project':
      return '\uD83D\uDCCB'
    default:
      return '\uD83D\uDCC5'
  }
}

function daysUntilText(startDate?: string): string {
  if (!startDate) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)
  const diffMs = start.getTime() - today.getTime()
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (days < 0) return 'ongoing'
  if (days === 0) return 'today'
  if (days === 1) return 'in 1 day'
  return `in ${days} days`
}

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-[4px] flex-1 rounded-full bg-[var(--color-border)]">
        <div
          className="h-full rounded-full bg-[var(--color-palette-1)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-text-muted whitespace-nowrap">
        {completed}/{total}
      </span>
    </div>
  )
}

function PlanCard({ plan }: { plan: UpcomingPlan }) {
  const countdown = daysUntilText(plan.startDate)

  return (
    <div className="py-[5px] border-b border-border last:border-b-0">
      <div className="flex items-center justify-between">
        <span className="text-[14px] text-text-primary truncate mr-2">
          {planTypeIcon(plan.planType)} {plan.name}
        </span>
        {countdown && (
          <span
            className={`text-[12px] font-semibold whitespace-nowrap ${
              countdown === 'today' || countdown === 'ongoing' ? 'text-success' : 'text-info'
            }`}
          >
            {countdown}
          </span>
        )}
      </div>
      {plan.checklistProgress && (
        <div className="mt-1">
          <ProgressBar
            completed={plan.checklistProgress.completed}
            total={plan.checklistProgress.total}
          />
        </div>
      )}
      {plan.nextItineraryItem && (
        <div className="text-[11px] text-text-muted mt-0.5 truncate">
          Next: {plan.nextItineraryItem.name}
        </div>
      )}
      <div className="text-[11px] text-text-muted mt-0.5">
        {plan.itemCounts.confirmed} confirmed, {plan.itemCounts.ideas} ideas
      </div>
    </div>
  )
}

export function PlanWidget() {
  const { data, isLoading, error } = usePlanWidget()

  if (isLoading) {
    return (
      <WidgetCard title="Plans" category="calendar">
        <LoadingSpinner />
      </WidgetCard>
    )
  }

  if (error) {
    return (
      <WidgetCard title="Plans" category="calendar">
        <div className="text-[13px] text-text-muted">Unable to load plans</div>
      </WidgetCard>
    )
  }

  const plans = data ?? []

  return (
    <WidgetCard title="Plans" category="calendar" badge={plans.length > 0 ? `${plans.length}` : undefined}>
      {plans.length === 0 ? (
        <div className="text-[13px] text-text-muted py-1">No upcoming plans</div>
      ) : (
        <div className="flex flex-col">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </WidgetCard>
  )
}

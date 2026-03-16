import { HeroStrip } from '../ui/HeroStrip'
import { WidgetCard } from '../ui/WidgetCard'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { useGoogleCalendar } from '@/widgets/calendar'
import { CalendarWidget } from '@/widgets/calendar'
import { useChores, ChoresWidget } from '@/widgets/chores'
import { LunchMenuWidget } from '@/widgets/lunch-menu'
import { useWeatherData } from '@/widgets/weather'
import type { CalendarEvent } from '@/lib/dashboard-api'

function getHeroEvents(events: CalendarEvent[] | null): { name: string; time: string; detail?: string }[] {
  if (!events || events.length === 0) return []

  const now = new Date()
  const sorted = [...events].sort((a, b) => {
    const aTime = a.start.dateTime ?? a.start.date ?? ''
    const bTime = b.start.dateTime ?? b.start.date ?? ''
    return aTime.localeCompare(bTime)
  })

  // Find current or next events
  const relevant = sorted.filter((e) => {
    const end = e.end.dateTime ?? e.end.date
    if (!end) return true
    return new Date(end) > now
  })

  return relevant.slice(0, 2).map((event) => {
    const start = event.start.dateTime ?? event.start.date
    let time = ''
    if (start) {
      if (event.start.date && !event.start.dateTime) {
        time = 'All day'
      } else {
        time = new Date(start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      }
    }
    return {
      name: event.summary ?? '(No title)',
      time,
      detail: event.location,
    }
  })
}

// Separate component so useWeatherData can throw without crashing the whole board
function WeatherHeroStrip({ heroEvents }: { heroEvents: { name: string; time: string; detail?: string }[] }) {
  const weather = useWeatherData()
  return (
    <HeroStrip
      events={heroEvents}
      weatherTemp={weather?.temperature}
      weatherCondition={weather?.condition}
      weatherIcon={weather?.icon}
    />
  )
}

function HeroStripFallback({ heroEvents }: { heroEvents: { name: string; time: string; detail?: string }[] }) {
  return <HeroStrip events={heroEvents} />
}

export function HomeBoard() {
  const calendar = useGoogleCalendar('primary')
  const chores = useChores()

  const heroEvents = getHeroEvents(calendar.data)

  return (
    <div
      className="grid gap-[var(--spacing-grid-gap)] h-full"
      style={{
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gridTemplateRows: 'auto 1fr 1fr',
      }}
    >
      {/* Hero strip -- full width */}
      <div style={{ gridColumn: '1 / -1' }}>
        <ErrorBoundary fallback={<HeroStripFallback heroEvents={heroEvents} />}>
          <WeatherHeroStrip heroEvents={heroEvents} />
        </ErrorBoundary>
      </div>

      {/* Calendar -- col 1, spans 2 rows */}
      <div style={{ gridRow: '2 / 4' }}>
        <CalendarWidget
          events={calendar.data}
          isLoading={calendar.isLoading}
          error={calendar.error}
          refetch={calendar.refetch}
        />
      </div>

      {/* Chores -- col 2, spans 2 rows */}
      <div style={{ gridRow: '2 / 4' }}>
        <ChoresWidget
          byChild={chores.byChild}
          completedCount={chores.completedCount}
          totalCount={chores.totalCount}
          isLoading={chores.assignments.isLoading}
          error={chores.assignments.error}
          refetch={chores.assignments.refetch}
          completeChore={chores.completeChore}
        />
      </div>

      {/* Countdowns -- col 3, row 1 */}
      <WidgetCard title="Coming Up" category="info">
        <div className="text-text-muted text-sm">Countdowns placeholder</div>
      </WidgetCard>

      {/* Sports -- col 4, row 1 */}
      <WidgetCard title="Sports" category="info">
        <div className="text-text-muted text-sm">Sports placeholder</div>
      </WidgetCard>

      {/* Lunch Menu -- col 3, row 2 */}
      <LunchMenuWidget />

      {/* Grocery List -- col 4, row 2 */}
      <WidgetCard title="Grocery List" category="grocery" badge="0 items">
        <div className="text-text-muted text-sm">Grocery list placeholder</div>
      </WidgetCard>
    </div>
  )
}

import { HeroStrip } from '../ui/HeroStrip'
import { WidgetCard } from '../ui/WidgetCard'

const placeholderEvents = [
  { name: 'Morning standup', time: '8:00 AM', detail: 'Zoom' },
  { name: 'Dentist - Emma', time: '9:30 AM', detail: 'Dr. Chen' },
]

export function HomeBoard() {
  return (
    <div
      className="grid gap-[var(--spacing-grid-gap)] h-full"
      style={{
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gridTemplateRows: 'auto 1fr 1fr',
      }}
    >
      {/* Hero strip — full width */}
      <div style={{ gridColumn: '1 / -1' }}>
        <HeroStrip
          events={placeholderEvents}
          weatherTemp="52"
          weatherCondition="Partly Cloudy"
        />
      </div>

      {/* Calendar — col 1, spans 2 rows */}
      <div style={{ gridRow: '2 / 4' }}>
        <WidgetCard title="Today's Schedule" category="calendar" badge="7 events" className="h-full">
          <div className="text-text-muted text-sm">Calendar widget placeholder</div>
        </WidgetCard>
      </div>

      {/* Chores — col 2, spans 2 rows */}
      <div style={{ gridRow: '2 / 4' }}>
        <WidgetCard title="Chores" category="chores" badge="0 of 0 done" className="h-full">
          <div className="text-text-muted text-sm">Chores widget placeholder</div>
        </WidgetCard>
      </div>

      {/* Countdowns — col 3, row 1 */}
      <WidgetCard title="Coming Up" category="info">
        <div className="text-text-muted text-sm">Countdowns placeholder</div>
      </WidgetCard>

      {/* Sports — col 4, row 1 */}
      <WidgetCard title="Sports" category="info">
        <div className="text-text-muted text-sm">Sports placeholder</div>
      </WidgetCard>

      {/* Lunch Menu — col 3, row 2 */}
      <WidgetCard title="Lunch Menu" category="food">
        <div className="text-text-muted text-sm">Lunch menu placeholder</div>
      </WidgetCard>

      {/* Grocery List — col 4, row 2 */}
      <WidgetCard title="Grocery List" category="grocery" badge="0 items">
        <div className="text-text-muted text-sm">Grocery list placeholder</div>
      </WidgetCard>
    </div>
  )
}

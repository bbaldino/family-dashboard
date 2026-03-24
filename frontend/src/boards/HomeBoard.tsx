import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HeroStrip } from '../ui/HeroStrip'
import type { HeroEvent } from '../ui/HeroStrip'
import { BottomSheet } from '../ui/BottomSheet'
import { WidgetCard } from '../ui/WidgetCard'
import { useGoogleCalendar, CalendarWidget } from '@/integrations/google-calendar'
import type { CalendarDay } from '@/integrations/google-calendar'
import { ChoresWidget } from '@/integrations/chores'
import { CountdownsWidget } from '@/integrations/countdowns'
import { LunchMenuWidget } from '@/integrations/nutrislice'
import { useHeroWeather, WeatherDetail } from '@/integrations/weather'
import { SportsWidget } from '@/integrations/sports'
import { PackagesWidget } from '@/integrations/packages'
import { TimerBanner } from '@/integrations/timers'
import { useDrivingTime } from '@/integrations/driving-time'
import type { EventDriveInfo } from '@/integrations/driving-time/types'

function getHeroEvents(
  days: CalendarDay[] | null,
  driveInfo: Record<string, EventDriveInfo>,
): HeroEvent[] {
  if (!days) return []

  // Get today's events
  const today = days.find((d) => d.isToday)
  if (!today || today.events.length === 0) return []

  const now = new Date()

  // Find current or next events
  const relevant = today.events.filter((e) => {
    const end = e.end.dateTime ?? e.end.date
    if (!end) return true
    return new Date(end) > now
  })

  return relevant.slice(0, 2).map((event) => {
    const start = event.start.dateTime ?? event.start.date
    let time = ''
    let isNow = false
    if (start) {
      if (event.start.date && !event.start.dateTime) {
        time = 'All day'
        isNow = true // all-day events are always "now"
      } else {
        const startDate = new Date(start)
        time = startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        isNow = startDate <= now
      }
    }
    const drive = driveInfo[event.id]
    return {
      name: event.summary ?? '(No title)',
      time,
      detail: event.location,
      isNow,
      driveTag: drive ? { displayText: drive.displayText, urgency: drive.urgency } : undefined,
    }
  })
}

function HeroStripWithData({ heroEvents }: { heroEvents: HeroEvent[] }) {
  const weather = useHeroWeather()
  const [showForecast, setShowForecast] = useState(false)
  const navigate = useNavigate()

  return (
    <>
      <HeroStrip
        events={heroEvents}
        weatherTemp={weather?.temperature}
        weatherHigh={weather?.high}
        weatherLow={weather?.low}
        weatherCondition={weather?.condition}
        weatherIcon={weather?.icon}
        onWeatherClick={() => setShowForecast(true)}
        onSettingsClick={() => navigate('/admin')}
      />
      <BottomSheet isOpen={showForecast} onClose={() => setShowForecast(false)}>
        <WeatherDetail />
      </BottomSheet>
    </>
  )
}

export function HomeBoard() {
  const calendar = useGoogleCalendar()

  const allEvents = (calendar.data ?? []).flatMap((d) => d.events)
  const driveInfo = useDrivingTime(allEvents)
  const heroEvents = getHeroEvents(calendar.data, driveInfo)

  return (
    <div
      className="grid gap-[var(--spacing-grid-gap)] h-full"
      style={{
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gridTemplateRows: 'auto auto 1fr 1fr',
      }}
    >
      {/* Timer banner -- full width, only shows when timers active */}
      <div style={{ gridColumn: '1 / -1' }}>
        <TimerBanner />
      </div>

      {/* Hero strip -- full width */}
      <div style={{ gridColumn: '1 / -1' }}>
        <HeroStripWithData heroEvents={heroEvents} />
      </div>

      {/* Calendar -- col 1, spans 2 rows */}
      <div style={{ gridRow: '3 / 5', minHeight: 0 }} className="overflow-hidden">
        <CalendarWidget
          days={calendar.data}
          isLoading={calendar.isLoading}
          error={calendar.error}
          refetch={calendar.refetch}
        />
      </div>

      {/* Packages -- col 2, row 2 */}
      <PackagesWidget />

      {/* Chores -- col 2, row 3 */}
      <div style={{ minHeight: 0 }} className="overflow-hidden">
        <ChoresWidget />
      </div>

      {/* Countdowns -- col 3, row 1 */}
      <CountdownsWidget />

      {/* Sports -- col 4, row 1 */}
      <SportsWidget />

      {/* Lunch Menu -- col 3, row 2 */}
      <LunchMenuWidget />

      {/* Grocery List -- col 4, row 2 */}
      <WidgetCard title="Grocery List" category="grocery" badge="0 items">
        <div className="text-text-muted text-sm">Grocery list placeholder</div>
      </WidgetCard>

    </div>
  )
}

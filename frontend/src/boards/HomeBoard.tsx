import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { HeroStrip } from '../ui/HeroStrip'
import type { HeroEvent } from '../ui/HeroStrip'
import { BottomSheet } from '../ui/BottomSheet'
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
import { OnThisDayWidget } from '@/integrations/on-this-day/OnThisDayWidget'
import { DEFAULT_WIDGET_META } from '@/lib/widget-types'
import type { WidgetSize } from '@/lib/widget-types'
import { useSportsWidgetMeta } from '@/integrations/sports/useWidgetMeta'
import { GridLayout } from './layouts/GridLayout'
import { MagazineLayout } from './layouts/MagazineLayout'
import type { MagazineWidget } from './layouts/MagazineLayout'

type LayoutMode = 'grid' | 'magazine'

function useLayoutMode(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>('grid')

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((config: Record<string, string>) => {
        const layout = config['dashboard.layout']
        if (layout === 'magazine' || layout === 'grid') {
          setMode(layout)
        }
      })
      .catch(() => {})
  }, [])

  return mode
}

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

function useWidgetMaxSizes(): Record<string, WidgetSize | undefined> {
  const [maxSizes, setMaxSizes] = useState<Record<string, WidgetSize | undefined>>({})

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((config: Record<string, string>) => {
        const sizes: Record<string, WidgetSize | undefined> = {}
        for (const [key, value] of Object.entries(config)) {
          const match = key.match(/^dashboard\.widget\.(.+)\.maxSize$/)
          if (match && (value === 'compact' || value === 'standard' || value === 'expanded')) {
            sizes[match[1]] = value as WidgetSize
          }
        }
        setMaxSizes(sizes)
      })
      .catch(() => {})
  }, [])

  return maxSizes
}

function Widgets({ layout }: { layout: LayoutMode }) {
  const sportsMeta = useSportsWidgetMeta()
  const maxSizes = useWidgetMaxSizes()

  const widgets: MagazineWidget[] = [
    { key: 'sports', element: <SportsWidget />, meta: sportsMeta, maxSize: maxSizes['sports'] },
    { key: 'packages', element: <PackagesWidget />, meta: DEFAULT_WIDGET_META, maxSize: maxSizes['packages'] },
    { key: 'countdowns', element: <CountdownsWidget />, meta: DEFAULT_WIDGET_META, maxSize: maxSizes['countdowns'] },
    { key: 'chores', element: <ChoresWidget />, meta: DEFAULT_WIDGET_META, maxSize: maxSizes['chores'] },
    { key: 'lunch', element: <LunchMenuWidget />, meta: DEFAULT_WIDGET_META, maxSize: maxSizes['lunch'] },
    { key: 'on-this-day', element: <OnThisDayWidget />, meta: DEFAULT_WIDGET_META, maxSize: maxSizes['on-this-day'] },
  ]

  const Layout = layout === 'magazine' ? MagazineLayout : GridLayout

  return <Layout widgets={widgets} />
}

export function HomeBoard() {
  const calendar = useGoogleCalendar()
  const layoutMode = useLayoutMode()

  const allEvents = (calendar.data ?? []).flatMap((d) => d.events)
  const driveInfo = useDrivingTime(allEvents)
  const heroEvents = getHeroEvents(calendar.data, driveInfo)

  return (
    <div className="flex flex-col gap-[var(--spacing-grid-gap)] h-full">
      {/* Timer banner -- full width, only shows when timers active */}
      <TimerBanner />

      {/* Hero strip -- full width */}
      <HeroStripWithData heroEvents={heroEvents} />

      {/* Main content: calendar left, widgets right */}
      <div className="flex gap-[var(--spacing-grid-gap)] flex-1 min-h-0">
        {/* Calendar -- fixed left column */}
        <div className="w-1/4 min-h-0 overflow-hidden">
          <CalendarWidget
            days={calendar.data}
            isLoading={calendar.isLoading}
            error={calendar.error}
            refetch={calendar.refetch}
          />
        </div>

        {/* Widgets area */}
        <Widgets layout={layoutMode} />
      </div>
    </div>
  )
}

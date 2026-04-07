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
import { WordOfTheDayWidget } from '@/integrations/word-of-the-day/WordOfTheDayWidget'
import { useWordOfTheDayWidgetMeta } from '@/integrations/word-of-the-day/useWidgetMeta'
import { DailyQuoteWidget } from '@/integrations/daily-quote/DailyQuoteWidget'
import { useDailyQuoteWidgetMeta } from '@/integrations/daily-quote/useWidgetMeta'
import { TriviaWidget } from '@/integrations/trivia/TriviaWidget'
import { useTriviaWidgetMeta } from '@/integrations/trivia/useWidgetMeta'
import { JokeWidget } from '@/integrations/jokes/JokeWidget'
import { useJokeWidgetMeta } from '@/integrations/jokes/useWidgetMeta'
import { useSportsWidgetMeta } from '@/integrations/sports/useWidgetMeta'
import { usePackagesWidgetMeta } from '@/integrations/packages/useWidgetMeta'
import { useChoresWidgetMeta } from '@/integrations/chores/useWidgetMeta'
import { useCountdownsWidgetMeta } from '@/integrations/countdowns/useWidgetMeta'
import { useLunchWidgetMeta } from '@/integrations/nutrislice/useWidgetMeta'
import { useOnThisDayWidgetMeta } from '@/integrations/on-this-day/useWidgetMeta'
import { MetaFillerWidget } from '@/ui/MetaFillerWidget'
import { CellGridLayout } from './layouts/CellGridLayout'
import type { CellGridWidget } from './layouts/CellGridLayout'
import { placeWidgets, computeSpan, type GridWidget } from './layouts/gridEngine'
import { useCalendarWidgetMeta } from '@/integrations/google-calendar/useWidgetMeta'

function useGridConfig(): { columns: number; rows: number } {
  const [config, setConfig] = useState({ columns: 8, rows: 6 })

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        const cols = parseInt(data['dashboard.columns'] ?? '8', 10) || 8
        const rows = parseInt(data['dashboard.rows'] ?? '6', 10) || 6
        setConfig({ columns: cols, rows: rows })
      })
      .catch(() => {})
  }, [])

  return config
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

function Widgets({
  grid,
  calendarDays,
  calendarLoading,
  calendarError,
  calendarRefetch,
}: {
  grid: { columns: number; rows: number }
  calendarDays: CalendarDay[] | null
  calendarLoading: boolean
  calendarError: string | null
  calendarRefetch: () => Promise<void>
}) {
  const calendarMeta = useCalendarWidgetMeta()
  const sportsMeta = useSportsWidgetMeta()
  const packagesMeta = usePackagesWidgetMeta()
  const choresMeta = useChoresWidgetMeta()
  const countdownsMeta = useCountdownsWidgetMeta()
  const lunchMeta = useLunchWidgetMeta()
  const onThisDayMeta = useOnThisDayWidgetMeta()
  const wordMeta = useWordOfTheDayWidgetMeta()
  const quoteMeta = useDailyQuoteWidgetMeta()
  const triviaMeta = useTriviaWidgetMeta()
  const jokeMeta = useJokeWidgetMeta()

  const calendarElement = (
    <CalendarWidget
      days={calendarDays}
      isLoading={calendarLoading}
      error={calendarError}
      refetch={calendarRefetch}
    />
  )

  const contentWidgets: CellGridWidget[] = [
    { key: 'calendar', element: calendarElement, meta: calendarMeta },
    { key: 'sports', element: <SportsWidget />, meta: sportsMeta },
    { key: 'packages', element: <PackagesWidget />, meta: packagesMeta },
    { key: 'countdowns', element: <CountdownsWidget />, meta: countdownsMeta },
    { key: 'chores', element: <ChoresWidget />, meta: choresMeta },
    { key: 'lunch', element: <LunchMenuWidget />, meta: lunchMeta },
  ]

  const fillerWidgets: CellGridWidget[] = [
    { key: 'on-this-day', element: <OnThisDayWidget />, meta: onThisDayMeta },
    { key: 'word-of-the-day', element: <WordOfTheDayWidget />, meta: wordMeta },
    { key: 'daily-quote', element: <DailyQuoteWidget />, meta: quoteMeta },
    { key: 'trivia', element: <TriviaWidget />, meta: triviaMeta },
    { key: 'jokes', element: <JokeWidget />, meta: jokeMeta },
  ]

  const visibleContent = contentWidgets.filter((w) => w.meta.visible)
  const visibleFillers = fillerWidgets.filter((w) => w.meta.visible)

  // Dry run: place content + all fillers to see how many fillers fit at their requested size
  const allForDryRun = [...visibleContent, ...visibleFillers]
    .filter((w): w is CellGridWidget & { meta: { visible: true } } => w.meta.visible)
    .map((w) => ({ key: w.key, element: w.element, meta: w.meta as GridWidget['meta'] }))
  const { placed: dryPlaced } = placeWidgets(allForDryRun, grid)

  // Count fillers that were placed at their full requested size (not downgraded)
  const fillerKeys = new Set(visibleFillers.map((f) => f.key))
  let fillerSlots = 0
  for (const p of dryPlaced) {
    if (!fillerKeys.has(p.key)) continue
    const filler = visibleFillers.find((f) => f.key === p.key)
    if (!filler || !filler.meta.visible) continue
    const requested = computeSpan((filler.meta as { visible: true; sizePreference: GridWidget['meta']['sizePreference'] }).sizePreference, grid)
    if (p.colSpan === requested.colSpan && p.rowSpan === requested.rowSpan) {
      fillerSlots++
    }
  }

  let widgets: CellGridWidget[]
  if (fillerSlots >= visibleFillers.length) {
    // All fillers fit at their requested size — show individually
    widgets = [...visibleContent, ...visibleFillers]
  } else if (visibleFillers.length > 0) {
    // Not all fillers fit — bundle ALL into meta widget
    const metaElement = (
      <MetaFillerWidget
        fillers={visibleFillers.map((f) => ({ key: f.key, element: f.element }))}
      />
    )
    widgets = [
      ...visibleContent,
      {
        key: 'meta-filler',
        element: metaElement,
        meta: { visible: true, priority: 1, sizePreference: { orientation: 'square', relativeSize: 'large' } },
      },
    ]
  } else {
    widgets = visibleContent
  }

  return <CellGridLayout widgets={widgets} columns={grid.columns} rows={grid.rows} />
}

export function HomeBoard() {
  const calendar = useGoogleCalendar()
  const grid = useGridConfig()

  const allEvents = (calendar.data ?? []).flatMap((d) => d.events)
  const driveInfo = useDrivingTime(allEvents)
  const heroEvents = getHeroEvents(calendar.data, driveInfo)

  return (
    <div className="flex flex-col gap-[var(--spacing-grid-gap)] h-full">
      {/* Timer banner -- full width, only shows when timers active */}
      <TimerBanner />

      {/* Hero strip -- full width */}
      <HeroStripWithData heroEvents={heroEvents} />

      {/* Grid layout with all widgets including calendar */}
      <Widgets
        grid={grid}
        calendarDays={calendar.data}
        calendarLoading={calendar.isLoading}
        calendarError={calendar.error}
        calendarRefetch={calendar.refetch}
      />
    </div>
  )
}

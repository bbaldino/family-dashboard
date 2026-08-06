import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { HeroStrip } from '@/themes/grid/ui/HeroStrip'
import type { HeroEvent } from '@/themes/grid/ui/HeroStrip'
import { BottomSheet } from '@/ui/BottomSheet'
import { useAllConfig } from '@/platform'
import { gridSettingsSchema } from '@/themes/grid/settings-declaration'
import { useGoogleCalendar } from '@/data/google-calendar'
import type { CalendarDay } from '@/data/google-calendar'
import { CalendarWidget } from '@/themes/grid/widgets/google-calendar/CalendarWidget'
import { ChoresWidget } from '@/themes/grid/widgets/chores/ChoresWidget'
import { CountdownsWidget } from '@/themes/grid/widgets/countdowns/CountdownsWidget'
import { LunchMenuWidget } from '@/themes/grid/widgets/nutrislice/LunchMenuWidget'
import { useHeroWeather } from '@/data/weather'
import { WeatherDetail } from '@/themes/grid/widgets/weather/WeatherDetail'
import { SportsWidget } from '@/themes/grid/widgets/sports/SportsWidget'
import { PackagesWidget } from '@/themes/grid/widgets/packages/PackagesWidget'
import { TimerBanner } from '@/themes/grid/widgets/timers/TimerBanner'
import { useDrivingTime } from '@/data/driving-time'
import type { EventDriveInfo } from '@/data/driving-time'
import { OnThisDayWidget } from '@/themes/grid/widgets/on-this-day/OnThisDayWidget'
import { WordOfTheDayWidget } from '@/themes/grid/widgets/word-of-the-day/WordOfTheDayWidget'
import { useWordOfTheDayWidgetMeta } from '@/themes/grid/widget-meta/word-of-the-day'
import { useSportsWidgetMeta } from '@/themes/grid/widget-meta/sports'
import { usePackagesWidgetMeta } from '@/themes/grid/widget-meta/packages'
import { useChoresWidgetMeta } from '@/themes/grid/widget-meta/chores'
import { useCountdownsWidgetMeta } from '@/themes/grid/widget-meta/countdowns'
import { useLunchWidgetMeta } from '@/themes/grid/widget-meta/nutrislice'
import { useOnThisDayWidgetMeta } from '@/themes/grid/widget-meta/on-this-day'
import { MetaFillerWidget } from '@/themes/grid/ui/MetaFillerWidget'
import { CellGridLayout } from '@/themes/grid/layout/CellGridLayout'
import type { CellGridWidget } from '@/themes/grid/layout/CellGridLayout'
import { useCalendarWidgetMeta } from '@/themes/grid/widget-meta/google-calendar'

const GRID_CONFIG_PREFIX = 'theme.grid.'

/**
 * Grid's layout settings, read through the shared `/api/config` query and
 * validated against `gridSettingsSchema` — the same schema that backs the
 * admin settings panel, so the renderer and the form can't disagree about
 * what "default" means. Replaces two separate mount-only `fetch` calls that
 * used to read the now-retired `dashboard.*` keys; going through
 * `useAllConfig` also means a layout change now shows up within its poll
 * interval instead of requiring a page reload.
 */
function useGridSettings() {
  const { data } = useAllConfig()

  return useMemo(() => {
    const scoped: Record<string, string> = {}
    for (const [key, value] of Object.entries(data ?? {})) {
      if (key.startsWith(GRID_CONFIG_PREFIX)) {
        scoped[key.slice(GRID_CONFIG_PREFIX.length)] = value
      }
    }
    const result = gridSettingsSchema.safeParse(scoped)
    return result.success ? result.data : gridSettingsSchema.parse({})
  }, [data])
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
  hidden,
  calendarDays,
  calendarLoading,
  calendarError,
  calendarRefetch,
}: {
  grid: { columns: number; rows: number }
  hidden: Set<string>
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

  const calendarElement = (
    <CalendarWidget
      days={calendarDays}
      isLoading={calendarLoading}
      error={calendarError}
      refetch={calendarRefetch}
    />
  )

  const allContent: CellGridWidget[] = [
    { key: 'calendar', element: calendarElement, meta: calendarMeta },
    { key: 'sports', element: <SportsWidget />, meta: sportsMeta },
    { key: 'packages', element: <PackagesWidget />, meta: packagesMeta },
    { key: 'countdowns', element: <CountdownsWidget />, meta: countdownsMeta },
    { key: 'chores', element: <ChoresWidget />, meta: choresMeta },
    { key: 'lunch', element: <LunchMenuWidget />, meta: lunchMeta },
  ]

  const allFillers: CellGridWidget[] = [
    { key: 'on-this-day', element: <OnThisDayWidget />, meta: onThisDayMeta },
    { key: 'word-of-the-day', element: <WordOfTheDayWidget />, meta: wordMeta },
  ]

  const contentWidgets = allContent.filter((w) => !hidden.has(w.key))
  const fillerWidgets = allFillers.filter((w) => !hidden.has(w.key))

  const visibleContent = contentWidgets.filter((w) => w.meta.visible)
  const visibleFillers = fillerWidgets.filter((w) => w.meta.visible)

  // Always bundle fillers into a single meta widget
  let widgets: CellGridWidget[]
  if (visibleFillers.length > 0) {
    const metaElement = (
      <MetaFillerWidget fillers={visibleFillers.map((f) => ({ key: f.key, element: f.element }))} />
    )
    widgets = [
      ...visibleContent,
      {
        key: 'meta-filler',
        element: metaElement,
        meta: {
          visible: true,
          priority: 1,
          sizePreference: { orientation: 'square', relativeSize: 'medium' },
        },
      },
    ]
  } else {
    widgets = visibleContent
  }

  return <CellGridLayout widgets={widgets} columns={grid.columns} rows={grid.rows} />
}

export function HomeBoard() {
  const calendar = useGoogleCalendar()
  const gridSettings = useGridSettings()
  const grid = { columns: gridSettings.columns, rows: gridSettings.rows }
  const hidden = useMemo(
    () =>
      new Set(
        gridSettings.hidden
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    [gridSettings.hidden],
  )

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
        hidden={hidden}
        calendarDays={calendar.data}
        calendarLoading={calendar.isLoading}
        calendarError={calendar.error}
        calendarRefetch={calendar.refetch}
      />
    </div>
  )
}

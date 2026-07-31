import { useGoogleCalendar } from '@/data/google-calendar'
import type { CalendarDay, CalendarEvent } from '@/data/google-calendar'
import { useSportsGames } from '@/data/sports'
import { useLunchMenu } from '@/data/nutrislice'
import { DoubleRule } from '@/themes/broadsheet/ui/DoubleRule'
import { Masthead } from '@/themes/broadsheet/home/Masthead'
import { ScheduleColumn } from '@/themes/broadsheet/home/ScheduleColumn'
import { SportsColumn } from '@/themes/broadsheet/home/SportsColumn'
import { GlanceStrip } from '@/themes/broadsheet/home/GlanceStrip'
import { buildStandfirst } from '@/themes/broadsheet/home/standfirst'
import { useNow } from '@/themes/broadsheet/home/useNow'
import { isAllDay } from '@/themes/broadsheet/home/event-format'

/** Today's events that haven't started yet — all-day events always count. */
function upcomingTodayEvents(today: CalendarDay | undefined, now: Date): CalendarEvent[] {
  if (!today) return []
  return (today.events ?? []).filter((event) => {
    if (isAllDay(event) || !event.start.dateTime) return true
    return new Date(event.start.dateTime).getTime() >= now.getTime()
  })
}

/**
 * The broadsheet front page: masthead over a two-column body (schedule,
 * sports) over the glance strip, filling the 1600x900 canvas the shell
 * scales to the viewport. The footer nav is part of `BroadsheetLayout`, not
 * this screen.
 *
 * Every hook here can boot with no data on a cold cache — the tablet's
 * first second after power-on — so nothing below assumes data has arrived.
 *
 * `useSportsGames()` opens its own SSE connection (on top of react-query's
 * polling), so it's called exactly once here and threaded down as props —
 * `SportsColumn` and, in turn, `OffdayBlock` don't call it themselves. Three
 * independent call sites once meant three permanent EventSource connections
 * to the same endpoint on a tablet that never reloads.
 */
export function Home() {
  const now = useNow()
  const { data: days } = useGoogleCalendar()
  const { data: sportsData, isLoading: sportsLoading } = useSportsGames()
  const { data: lunch } = useLunchMenu()

  const today = days?.find((day) => day.isToday)
  const upcoming = upcomingTodayEvents(today, now)
  const nextEvent = upcoming[0]

  const games = sportsData?.games ?? []
  const sportsState: 'live' | 'pregame' | 'none' = games.some((game) => game.state === 'live')
    ? 'live'
    : games.some((game) => game.state === 'upcoming')
      ? 'pregame'
      : 'none'

  const lunchToday = lunch?.today
  const lunchAvailable = !!lunchToday && (lunchToday.entries.length > 0 || lunchToday.extras.length > 0)

  const standfirst = buildStandfirst({
    eventCount: upcoming.length,
    nextEventTitle: nextEvent ? nextEvent.summary || 'Untitled' : null,
    sportsState,
    lunchAvailable,
  })

  return (
    <div data-testid="broadsheet-home" className="broadsheet-root w-[1600px] h-[900px] flex flex-col">
      <Masthead standfirst={standfirst} />
      {/*
       * This is a fixed 900px canvas with no scrolling — content that runs
       * long must clip, never spill onto the glance strip below it.
       * `overflow-hidden` here is the structural guarantee; `min-h-0` on
       * both the row and each column lets them actually shrink to fit
       * instead of growing to their content's min-content size (a grid/flex
       * item's default). `ScheduleColumn` also budgets its own day count so
       * the common case clips nothing at all — see its source for why.
       */}
      <div
        data-testid="broadsheet-home-body"
        className="flex-1 min-h-0 overflow-hidden grid gap-10 px-14"
        style={{ gridTemplateColumns: '1.5fr 1fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          <ScheduleColumn />
        </div>
        <div className="min-h-0 overflow-hidden">
          <SportsColumn data={sportsData} isLoading={sportsLoading} />
        </div>
      </div>
      <div className="px-14 pb-16">
        <DoubleRule />
        <GlanceStrip />
      </div>
    </div>
  )
}

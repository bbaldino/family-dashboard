import { useGoogleCalendar } from '@/data/google-calendar'
import type { CalendarDay, CalendarEvent } from '@/data/google-calendar'
import { useSportsGames } from '@/data/sports'
import { useLunchMenu } from '@/data/nutrislice'
import { Masthead } from '@/themes/broadsheet/home/Masthead'
import { ScheduleColumn } from '@/themes/broadsheet/home/ScheduleColumn'
import { SportsColumn } from '@/themes/broadsheet/home/SportsColumn'
import { pickFeaturedGame } from '@/themes/broadsheet/home/featured-game'
import { HouseholdColumn } from '@/themes/broadsheet/home/HouseholdColumn'
import { WeatherStrip } from '@/themes/broadsheet/home/WeatherStrip'
import { buildStandfirst } from '@/themes/broadsheet/home/standfirst'
import { useNow } from '@/themes/broadsheet/home/useNow'
import { isAllDay, nextEventLabel } from '@/themes/broadsheet/home/event-format'

/** Off-day/pregame vs. live column ratios for the three-column body — the
 *  sports column widens and the schedule column narrows once a game goes
 *  live, so the page re-proportions around it. Values from the design mock
 *  (`broadsheet-v2.jsx:139`). */
const BODY_COLUMNS_OFFDAY = '1.5fr 1fr 0.9fr'
const BODY_COLUMNS_LIVE = '0.85fr 1.6fr 0.78fr'

/** Today's events that haven't started yet — all-day events always count. */
function upcomingTodayEvents(today: CalendarDay | undefined, now: Date): CalendarEvent[] {
  if (!today) return []
  return (today.events ?? []).filter((event) => {
    if (isAllDay(event) || !event.start.dateTime) return true
    return new Date(event.start.dateTime).getTime() >= now.getTime()
  })
}

/**
 * The broadsheet front page: masthead over a three-column body — schedule,
 * sports, and the household rundown — filling the 1600x900 canvas the shell
 * scales to the viewport. The footer nav (and now-playing) is part of
 * `BroadsheetLayout`, not this screen.
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
  // The masthead standfirst's right-hand summary (mock: `broadsheet-v2.jsx:132`)
  // — total events across the whole week the calendar hook already fetched,
  // and a compact "time until" for whatever's next.
  const totalEvents = (days ?? []).reduce((sum, day) => sum + (day.events?.length ?? 0), 0)
  const nextEventSummary = nextEventLabel(nextEvent, now)

  // The same featured-game pick `SportsColumn` dispatches on, so the body's
  // column ratios and the standfirst's sports mention can never disagree
  // with what the sports column actually renders underneath them.
  const games = sportsData?.games ?? []
  const featuredGame = pickFeaturedGame(games)
  const sportsState: 'live' | 'pregame' | 'none' =
    featuredGame?.state === 'live' ? 'live' : featuredGame ? 'pregame' : 'none'

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
      <Masthead
        standfirst={standfirst}
        isLive={sportsState === 'live'}
        nextEventSummary={nextEventSummary}
        totalEvents={totalEvents}
      />
      {/*
       * This is a fixed 900px canvas with no scrolling — content that runs
       * long must clip, never spill under the footer. `overflow-hidden` here
       * is the structural guarantee; `min-h-0` on both the row and each
       * column lets them actually shrink to fit instead of growing to their
       * content's min-content size (a grid/flex item's default).
       * `ScheduleColumn` and `LiveGame` also budget their own item counts so
       * the common case clips nothing at all — see their source for why.
       *
       * The body is the flex column's only `flex-1` item, so it's what
       * shrinks to make room for `WeatherStrip` below it and the 64px
       * spacer that follows — the footer itself is pinned absolutely by
       * `BroadsheetLayout`, outside this flex column's own height
       * accounting, so the spacer exists purely to keep this column's flow
       * from painting underneath it.
       *
       * Column ratios come straight from the design mock
       * (`broadsheet-v2.jsx:139`): off-day/pregame favours the schedule;
       * live, sports blooms into the wider slot and the schedule narrows to
       * make room, which is why its rows must keep fitting a tighter column.
       */}
      <div
        data-testid="broadsheet-home-body"
        className="flex-1 min-h-0 overflow-hidden grid"
        style={{
          gridTemplateColumns: sportsState === 'live' ? BODY_COLUMNS_LIVE : BODY_COLUMNS_OFFDAY,
          gap: 0,
          paddingTop: 12,
        }}
      >
        <div
          className="min-h-0 overflow-hidden"
          style={{ padding: '0 24px 0 56px', borderRight: '1px solid var(--rule)' }}
        >
          <ScheduleColumn isLive={sportsState === 'live'} />
        </div>
        <div
          className="min-h-0 overflow-hidden"
          style={{ padding: '0 24px', borderRight: '1px solid var(--rule)' }}
        >
          <SportsColumn data={sportsData} isLoading={sportsLoading} />
        </div>
        <div className="min-h-0 overflow-hidden" style={{ padding: '0 56px 0 24px' }}>
          <HouseholdColumn />
        </div>
      </div>
      <WeatherStrip />
      {/* Reserves the 64px the footer occupies (see `BroadsheetLayout`) — see
       *  the body comment above for why a spacer is needed at all. */}
      <div style={{ flexShrink: 0, height: 64 }} />
    </div>
  )
}

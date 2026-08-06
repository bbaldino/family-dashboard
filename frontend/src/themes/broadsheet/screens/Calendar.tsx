import { useState } from 'react'
import { useMonthCalendar } from '@/integrations/google-calendar'
import { useCountdowns } from '@/integrations/countdowns'
import { DatebookMasthead } from '@/themes/broadsheet/datebook/DatebookMasthead'
import { MonthGrid } from '@/themes/broadsheet/datebook/MonthGrid'
import { computeMonthTally } from '@/themes/broadsheet/datebook/tally'
import { buildDatebookStandfirst } from '@/themes/broadsheet/datebook/standfirst'
import { shiftMonth } from '@/themes/broadsheet/datebook/month-nav'
import { useNow } from '@/themes/broadsheet/home/useNow'

/**
 * The Datebook: broadsheet's month calendar, the same editorial register as
 * Home — masthead over a fixed 1600x900 canvas the shell scales. The footer
 * nav (and now-playing) is part of `BroadsheetLayout`, not this screen, the
 * same as Home.
 *
 * The screen owns the displayed `year`/`month` — the shell owns URLs, and
 * there is no route parameter for a month (`ROUTE_PATHS.calendar` is a bare
 * static path) — initialised once from the real current date rather than
 * `useNow()`, so navigating months doesn't get reset by that hook's 30s
 * tick.
 *
 * Every hook here can boot with no data on a cold cache, same as Home:
 * `useMonthCalendar` returns `null` until its first fetch resolves, and
 * `MonthGrid`/`computeMonthTally` both treat a missing `byDate` as empty
 * rather than guarding separately at every call site.
 */
export function Calendar() {
  const now = useNow()
  const [{ year, month }, setDisplayed] = useState(() => {
    const today = new Date()
    return { year: today.getFullYear(), month: today.getMonth() }
  })

  const { data: monthEvents } = useMonthCalendar(year, month)
  const { data: countdowns } = useCountdowns()

  const byDate = monthEvents?.byDate ?? {}
  const tally = computeMonthTally({ byDate }, year, month)
  const nearestCountdown = countdowns?.[0]
    ? { name: countdowns[0].name, daysUntil: countdowns[0].daysUntil }
    : null
  const standfirst = buildDatebookStandfirst({ eventCount: tally.eventCount, nearestCountdown })

  // The functional setState form — not `setDisplayed(shiftMonth(year, month, delta))`
  // — matters here: these callbacks are recreated once per render, closing
  // over that render's `year`/`month`. Two clicks landing in the same
  // React batch (a real possibility on a touchscreen kiosk with no debounce)
  // would otherwise both compute from the same stale values and net out to
  // a single month of movement instead of two — found live by firing the
  // prev button five times in one tick and watching the month move back
  // only one. `setDisplayed`'s updater always sees the latest state, batch
  // or not.
  const goToPrevMonth = () => setDisplayed(({ year, month }) => shiftMonth(year, month, -1))
  const goToNextMonth = () => setDisplayed(({ year, month }) => shiftMonth(year, month, 1))

  return (
    <div
      data-testid="broadsheet-calendar"
      className="broadsheet-root w-[1600px] h-[900px] flex flex-col"
    >
      <DatebookMasthead
        year={year}
        month={month}
        onPrevMonth={goToPrevMonth}
        onNextMonth={goToNextMonth}
        tally={tally}
        standfirst={standfirst}
        now={now}
      />
      {/* Fixed canvas, no scrolling — `min-h-0` lets the grid actually
       *  shrink to the space `calc(900px - 192px - 64px)` implies rather
       *  than growing to its content's min-content size. Mock:
       *  `calendar.jsx:265` (`padding: 8px 56px 0`); the 64px the footer
       *  reserves is a spacer below, same as Home. */}
      <div className="flex-1 min-h-0 overflow-hidden" style={{ padding: '8px 56px 0' }}>
        <MonthGrid year={year} month={month} byDate={byDate} />
      </div>
      <div style={{ flexShrink: 0, height: 64 }} />
    </div>
  )
}

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { ScheduleColumn } from './ScheduleColumn'

const useGoogleCalendar = vi.hoisted(() => vi.fn())
vi.mock('@/integrations/calendar', () => ({ useGoogleCalendar }))
const useDrivingTime = vi.hoisted(() => vi.fn())
vi.mock('@/integrations/driving-time', () => ({ useDrivingTime }))

/** A timed event today with real start/end times, for the clock-aware tests. */
const at = (summary: string, startHour: number, endHour: number) => ({
  id: summary,
  summary,
  start: { dateTime: `2026-05-22T${String(startHour).padStart(2, '0')}:00:00-07:00` },
  end: { dateTime: `2026-05-22T${String(endHour).padStart(2, '0')}:00:00-07:00` },
})

const allDay = (summary: string) => ({
  id: summary,
  summary,
  start: { date: '2026-05-22' },
  end: { date: '2026-05-23' },
})

const todayWith = (events: (ReturnType<typeof at> | ReturnType<typeof allDay>)[]) => ({
  date: new Date('2026-05-22T00:00:00'),
  label: 'Today',
  isToday: true,
  events,
})

const day = (dateIso: string, isToday: boolean, summaries: string[]) => ({
  date: new Date(dateIso),
  label: isToday ? 'Today' : 'Later',
  isToday,
  events: summaries.map((summary, i) => ({
    id: `${dateIso}-${i}`,
    summary,
    start: { dateTime: '2026-05-22T14:15:00-07:00' },
    end: { dateTime: '2026-05-22T14:30:00-07:00' },
  })),
})

describe('ScheduleColumn', () => {
  beforeEach(() => {
    // useDrivingTime returns the Record<string, EventDriveInfo> map directly —
    // not a react-query-shaped result. See src/integrations/driving-time/useDrivingTime.ts.
    useDrivingTime.mockReturnValue({})
    // `day()`'s events run 14:15-14:30; pin the clock before them so the Today
    // hero treats every one as still ahead unless a test says otherwise.
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date('2026-05-22T09:00:00-07:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders today as the hero and the rest of the week as the week-ahead strip', () => {
    // useGoogleCalendar's `data` is the CalendarDay[] itself (not
    // `{ days: [...] }`). See src/integrations/calendar/useGoogleCalendar.ts.
    // Index 0 is always today (see fetchCalendarEvents) — ScheduleColumn
    // relies on that rather than filtering on `isToday` itself.
    useGoogleCalendar.mockReturnValue({
      data: [
        day('2026-05-22T00:00:00', true, ['Pick up kids']),
        day('2026-05-23T00:00:00', false, ['Cages']),
      ],
      isLoading: false,
    })
    render(<ScheduleColumn />)
    expect(screen.getByText('Pick up kids')).toBeInTheDocument()
    expect(screen.getByText('Cages')).toBeInTheDocument()
    expect(screen.getByText('The week ahead')).toBeInTheDocument()
  })

  it('writes prose for an empty today instead of leaving a gap', () => {
    useGoogleCalendar.mockReturnValue({
      data: [day('2026-05-22T00:00:00', true, [])],
      isLoading: false,
    })
    render(<ScheduleColumn />)
    expect(screen.getByText(/blank docket/i)).toBeInTheDocument()
    expect(screen.getByText(/nothing pencilled in/i)).toBeInTheDocument()
  })

  it('writes an em dash for a clear day in the week-ahead strip', () => {
    useGoogleCalendar.mockReturnValue({
      data: [
        day('2026-05-22T00:00:00', true, ['Pick up kids']),
        day('2026-05-23T00:00:00', false, []),
      ],
      isLoading: false,
    })
    render(<ScheduleColumn />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders while the calendar is still loading', () => {
    useGoogleCalendar.mockReturnValue({ data: undefined, isLoading: true })
    expect(() => render(<ScheduleColumn />)).not.toThrow()
  })

  it('caps the week-ahead strip at 5 days even when the calendar returns a full week', () => {
    // Regression test: the calendar hook returns 7 days total (today plus
    // six more). Each week-ahead row is now a single compact line rather
    // than the old design's full day block, so more days fit safely than
    // the old MAX_VISIBLE_DAYS budget allowed — capped at 5 to match the
    // design mock (`broadsheet-v2.jsx:193`, `d.schedule.slice(1, 6)`).
    const week = Array.from({ length: 7 }, (_, i) =>
      day(`2026-05-${22 + i}T00:00:00`, i === 0, [`Event on day ${i}`]),
    )
    useGoogleCalendar.mockReturnValue({ data: week, isLoading: false })
    render(<ScheduleColumn />)
    // Day 0 renders as the Today hero.
    expect(screen.getByText('Event on day 0')).toBeInTheDocument()
    // Days 1-5 render in the week-ahead strip (5 days).
    expect(screen.getByText('Event on day 5')).toBeInTheDocument()
    // Day 6 is past the week-ahead budget.
    expect(screen.queryByText('Event on day 6')).not.toBeInTheDocument()
  })

  it('caps each week-ahead day at 3 events, or 2 while a game is live', () => {
    const busyDay = day('2026-05-23T00:00:00', false, ['First', 'Second', 'Third', 'Fourth'])
    useGoogleCalendar.mockReturnValue({
      data: [day('2026-05-22T00:00:00', true, []), busyDay],
      isLoading: false,
    })

    const { unmount } = render(<ScheduleColumn />)
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
    expect(screen.getByText('Third')).toBeInTheDocument()
    expect(screen.queryByText('Fourth')).not.toBeInTheDocument()
    expect(screen.getByText('+1 more')).toBeInTheDocument()
    unmount()

    render(<ScheduleColumn isLive />)
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
    expect(screen.queryByText('Third')).not.toBeInTheDocument()
    expect(screen.getByText('+2 more')).toBeInTheDocument()
  })

  it('lists every event today in the scrolling docket, not a capped few', () => {
    // The hero and the week-ahead strip share one fixed-height column. The
    // docket scrolls inside its own box rather than growing, so a packed day
    // (`?scenario=packed` has six) can't push the week off the page.
    useGoogleCalendar.mockReturnValue({
      data: [
        day('2026-05-22T00:00:00', true, ['One', 'Two', 'Three', 'Four', 'Five', 'Six']),
        day('2026-05-23T00:00:00', false, ['Tomorrow thing']),
      ],
      isLoading: false,
    })

    render(<ScheduleColumn />)
    expect(screen.getAllByTestId('today-event')).toHaveLength(6)
    expect(screen.queryByText(/more today/)).not.toBeInTheDocument()
    expect(screen.getByText('6 events')).toBeInTheDocument()
    expect(screen.getByText('Tomorrow thing')).toBeInTheDocument()
  })

  describe('as the day goes on', () => {
    const halloween = [
      at('Parade', 9, 10),
      at('Bake sale', 10, 11),
      at('Costume swap', 11, 12),
      at('Pumpkin carving', 12, 13),
      at('Trick-or-treat', 17, 19),
      at('Haunted house', 19, 21),
    ]

    const pastRows = () =>
      screen
        .getAllByTestId('today-event')
        .filter((row) => row.hasAttribute('data-past'))
        .map((row) => row.textContent)

    it('keeps finished events in the list, struck through above a NOW rule', () => {
      vi.setSystemTime(new Date('2026-05-22T14:00:00-07:00'))
      useGoogleCalendar.mockReturnValue({ data: [todayWith(halloween)], isLoading: false })

      render(<ScheduleColumn />)
      expect(pastRows()).toEqual([
        expect.stringContaining('Parade'),
        expect.stringContaining('Bake sale'),
        expect.stringContaining('Costume swap'),
        expect.stringContaining('Pumpkin carving'),
      ])
      expect(screen.getByTestId('now-rule')).toHaveTextContent('NOW · 2:00 PM')
      expect(screen.getByText('Haunted house')).toBeInTheDocument()
      expect(screen.getByText('6 events')).toBeInTheDocument()
    })

    it('moves an event above the NOW rule on its own once it ends', () => {
      vi.setSystemTime(new Date('2026-05-22T09:59:50-07:00'))
      useGoogleCalendar.mockReturnValue({ data: [todayWith(halloween)], isLoading: false })

      render(<ScheduleColumn />)
      expect(pastRows()).toEqual([])
      expect(screen.getByText('On now').closest('[data-testid="today-event"]')).toHaveTextContent(
        'Parade',
      )

      act(() => {
        vi.advanceTimersByTime(30_000)
      })
      expect(pastRows()).toEqual([expect.stringContaining('Parade')])
      // Bake sale started as Parade ended, so the tag moved on with the clock.
      expect(screen.getByText('On now').closest('[data-testid="today-event"]')).toHaveTextContent(
        'Bake sale',
      )
    })

    it('says the day is done once everything has ended, not that it was empty', () => {
      vi.setSystemTime(new Date('2026-05-22T22:00:00-07:00'))
      useGoogleCalendar.mockReturnValue({ data: [todayWith(halloween)], isLoading: false })

      render(<ScheduleColumn />)
      expect(pastRows()).toHaveLength(6)
      expect(screen.getByText('— the rest of the day is clear —')).toBeInTheDocument()
      expect(screen.queryByText('— a rare blank docket —')).not.toBeInTheDocument()
    })

    it('puts all-day events in one line under the headline instead of in the list', () => {
      // 2026-11-01's real shape: two all-day birthdays, a timed reminder that
      // morning, and one evening event.
      vi.setSystemTime(new Date('2026-05-22T14:00:00-07:00'))
      useGoogleCalendar.mockReturnValue({
        data: [
          todayWith([
            allDay("John Oxaal's birthday"),
            allDay("Alaire Orme's birthday"),
            at("Alaire's Bday", 8, 9),
            at('Bocce flea medicine', 18, 19),
          ]),
        ],
        isLoading: false,
      })

      render(<ScheduleColumn />)
      expect(screen.getByText('ALL DAY')).toBeInTheDocument()
      expect(screen.getByText('Birthdays: John Oxaal, Alaire Orme')).toBeInTheDocument()
      expect(screen.queryByText("John Oxaal's birthday")).not.toBeInTheDocument()
      expect(pastRows()).toEqual([expect.stringContaining("Alaire's Bday")])
      expect(screen.getByText('Bocce flea medicine')).toBeInTheDocument()
      expect(screen.getByText('4 events')).toBeInTheDocument()
    })

    it('says the rest of the day is clear when only all-day events are left', () => {
      useGoogleCalendar.mockReturnValue({
        data: [todayWith([allDay('Halloween')])],
        isLoading: false,
      })

      render(<ScheduleColumn />)
      expect(screen.getByText('Halloween')).toBeInTheDocument()
      expect(screen.getByText('— the rest of the day is clear —')).toBeInTheDocument()
      expect(screen.queryByText('— a rare blank docket —')).not.toBeInTheDocument()
    })
  })
})

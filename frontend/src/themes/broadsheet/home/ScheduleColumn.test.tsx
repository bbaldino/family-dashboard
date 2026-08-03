import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScheduleColumn } from './ScheduleColumn'

const useGoogleCalendar = vi.hoisted(() => vi.fn())
vi.mock('@/data/google-calendar', () => ({ useGoogleCalendar }))
const useDrivingTime = vi.hoisted(() => vi.fn())
vi.mock('@/data/driving-time', () => ({ useDrivingTime }))

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
    // not a react-query-shaped result. See src/data/driving-time/useDrivingTime.ts.
    useDrivingTime.mockReturnValue({})
  })

  it('renders today as the hero and the rest of the week as the week-ahead strip', () => {
    // useGoogleCalendar wraps usePolling, whose `data` is the CalendarDay[]
    // itself (not `{ days: [...] }`). See src/data/google-calendar/useGoogleCalendar.ts.
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

  it('caps each week-ahead day at 2 events, or 1 while a game is live', () => {
    const busyDay = day('2026-05-23T00:00:00', false, ['First', 'Second', 'Third'])
    useGoogleCalendar.mockReturnValue({
      data: [day('2026-05-22T00:00:00', true, []), busyDay],
      isLoading: false,
    })

    const { unmount } = render(<ScheduleColumn />)
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
    expect(screen.queryByText('Third')).not.toBeInTheDocument()
    expect(screen.getByText('+1 more')).toBeInTheDocument()
    unmount()

    render(<ScheduleColumn isLive />)
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.queryByText('Second')).not.toBeInTheDocument()
    expect(screen.getByText('+2 more')).toBeInTheDocument()
  })

  it('caps the today hero at 4 events so it cannot push the week off the page', () => {
    // The hero and the week-ahead strip share one fixed-height column, so an
    // uncapped hero doesn't overflow itself — it clips the week below it.
    // `?scenario=packed` (six events today) did exactly that: 30px cut off
    // the bottom of the week-ahead strip.
    useGoogleCalendar.mockReturnValue({
      data: [
        day('2026-05-22T00:00:00', true, ['One', 'Two', 'Three', 'Four', 'Five', 'Six']),
        day('2026-05-23T00:00:00', false, ['Tomorrow thing']),
      ],
      isLoading: false,
    })

    render(<ScheduleColumn />)
    expect(screen.getByText('Four')).toBeInTheDocument()
    expect(screen.queryByText('Five')).not.toBeInTheDocument()
    expect(screen.getByText('+2 more today')).toBeInTheDocument()
    // The count above the headline still reports the real total, not the
    // capped one — "4 events" when there are six would be a lie.
    expect(screen.getByText('6 events')).toBeInTheDocument()
    // And the week-ahead still renders, which is the point of the cap.
    expect(screen.getByText('Tomorrow thing')).toBeInTheDocument()
  })
})

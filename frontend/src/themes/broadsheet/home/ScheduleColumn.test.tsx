import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScheduleColumn } from './ScheduleColumn'

const useGoogleCalendar = vi.hoisted(() => vi.fn())
vi.mock('@/data/google-calendar', () => ({ useGoogleCalendar }))
const useDrivingTime = vi.hoisted(() => vi.fn())
vi.mock('@/data/driving-time', () => ({ useDrivingTime }))

const day = (label: string, isToday: boolean, summaries: string[]) => ({
  date: new Date('2026-05-22T12:00:00-07:00'),
  label,
  isToday,
  events: summaries.map((summary, i) => ({
    id: `${label}-${i}`,
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

  it('lists events grouped by day', () => {
    // useGoogleCalendar wraps usePolling, whose `data` is the CalendarDay[]
    // itself (not `{ days: [...] }`). See src/data/google-calendar/useGoogleCalendar.ts.
    useGoogleCalendar.mockReturnValue({
      data: [day('TODAY', true, ['Pick up kids']), day('TOMORROW', false, ['Cages'])],
      isLoading: false,
    })
    render(<ScheduleColumn />)
    expect(screen.getByText('Pick up kids')).toBeInTheDocument()
    expect(screen.getByText('Cages')).toBeInTheDocument()
  })

  it('writes prose for an empty day instead of leaving a gap', () => {
    useGoogleCalendar.mockReturnValue({
      data: [day('TODAY', true, [])],
      isLoading: false,
    })
    render(<ScheduleColumn />)
    expect(screen.getByText(/nothing|clear|free/i)).toBeInTheDocument()
  })

  it('renders while the calendar is still loading', () => {
    useGoogleCalendar.mockReturnValue({ data: undefined, isLoading: true })
    expect(() => render(<ScheduleColumn />)).not.toThrow()
  })

  it('renders no more than the day budget even when the calendar returns a full week', () => {
    // Regression test: the calendar hook returns ~7 days, and each one —
    // even an empty one — costs a heading, a rule, and a prose line. Seven
    // of those overflowed the column's allotted height on a real 1600x900
    // render and printed on top of the glance strip below it. The column
    // caps itself at 4 days so the common case never reaches that point;
    // jsdom can't measure real layout, so this asserts the day count
    // directly instead.
    const week = Array.from({ length: 7 }, (_, i) => day(`DAY${i}`, i === 0, []))
    useGoogleCalendar.mockReturnValue({ data: week, isLoading: false })
    render(<ScheduleColumn />)
    expect(screen.getByText('DAY0')).toBeInTheDocument()
    expect(screen.getByText('DAY3')).toBeInTheDocument()
    expect(screen.queryByText('DAY4')).not.toBeInTheDocument()
    expect(screen.queryByText('DAY5')).not.toBeInTheDocument()
    expect(screen.queryByText('DAY6')).not.toBeInTheDocument()
  })
})

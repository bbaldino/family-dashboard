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
})

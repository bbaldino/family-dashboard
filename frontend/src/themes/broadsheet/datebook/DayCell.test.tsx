import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DayCell } from './DayCell'
import type { CalendarEvent } from '@/data/google-calendar'

const timed = (id: string, summary: string): CalendarEvent => ({
  id,
  summary,
  start: { dateTime: '2026-05-10T16:00:00-07:00' },
  end: { dateTime: '2026-05-10T16:45:00-07:00' },
})

const baseProps = {
  date: new Date(2026, 4, 10),
  events: [] as CalendarEvent[],
  isCurrentMonth: true,
  isToday: false,
  isFirstCellOfGrid: false,
  isLastColumn: false,
  isLastRow: false,
  maxEvents: 5,
}

describe('DayCell', () => {
  it('renders the day number', () => {
    render(<DayCell {...baseProps} />)
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('shows all events up to maxEvents', () => {
    const events = Array.from({ length: 5 }, (_, i) => timed(`e${i}`, `Event ${i}`))
    render(<DayCell {...baseProps} events={events} maxEvents={5} />)
    for (const event of events) expect(screen.getByText(event.summary!)).toBeInTheDocument()
    expect(screen.queryByText(/more/)).not.toBeInTheDocument()
  })

  it('collapses events past maxEvents into a "+N more" line', () => {
    // Mirrors the ?scenario=packed fixture's six-event day.
    const events = Array.from({ length: 6 }, (_, i) => timed(`e${i}`, `Event ${i}`))
    render(<DayCell {...baseProps} events={events} maxEvents={5} />)
    for (let i = 0; i < 5; i++) expect(screen.getByText(`Event ${i}`)).toBeInTheDocument()
    expect(screen.queryByText('Event 5')).not.toBeInTheDocument()
    expect(screen.getByText('+1 more')).toBeInTheDocument()
  })

  it('respects a tighter maxEvents for shorter grids', () => {
    const events = Array.from({ length: 3 }, (_, i) => timed(`e${i}`, `Event ${i}`))
    render(<DayCell {...baseProps} events={events} maxEvents={2} />)
    expect(screen.getByText('Event 0')).toBeInTheDocument()
    expect(screen.getByText('Event 1')).toBeInTheDocument()
    expect(screen.queryByText('Event 2')).not.toBeInTheDocument()
    expect(screen.getByText('+1 more')).toBeInTheDocument()
  })

  it('renders today with a filled numeral disc', () => {
    render(<DayCell {...baseProps} isToday />)
    const numeral = screen.getByText('10')
    expect(numeral.style.borderRadius).toBe('22px')
    expect(numeral.style.background).toContain('rust')
  })

  it('labels the first visible day of a trailing adjacent month', () => {
    render(<DayCell {...baseProps} date={new Date(2026, 5, 1)} isCurrentMonth={false} />)
    expect(screen.getByText('JUN')).toBeInTheDocument()
  })

  it('labels the very first grid cell when it opens a leading adjacent month', () => {
    render(<DayCell {...baseProps} date={new Date(2026, 3, 26)} isCurrentMonth={false} isFirstCellOfGrid />)
    expect(screen.getByText('APR')).toBeInTheDocument()
  })

  it('does not label an adjacent-month day that is neither day 1 nor the grid start', () => {
    render(<DayCell {...baseProps} date={new Date(2026, 3, 27)} isCurrentMonth={false} />)
    expect(screen.queryByText('APR')).not.toBeInTheDocument()
  })

  it('never labels a day inside the currently displayed month', () => {
    render(<DayCell {...baseProps} date={new Date(2026, 4, 1)} isCurrentMonth />)
    expect(screen.queryByText('MAY')).not.toBeInTheDocument()
  })
})

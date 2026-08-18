import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DayCell } from './DayCell'
import type { CalendarEvent } from '@/providers/google-calendar'

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
    // Seven on a cap of five: two must hide, so the "+N more" line appears
    // (six would be absorbed — see the lone-overflow test below).
    const events = Array.from({ length: 7 }, (_, i) => timed(`e${i}`, `Event ${i}`))
    render(<DayCell {...baseProps} events={events} maxEvents={5} />)
    for (let i = 0; i < 5; i++) expect(screen.getByText(`Event ${i}`)).toBeInTheDocument()
    expect(screen.queryByText('Event 5')).not.toBeInTheDocument()
    expect(screen.getByText('+2 more')).toBeInTheDocument()
  })

  it('absorbs a lone overflow rather than printing a useless "+1 more"', () => {
    // One event past the cap costs the same single line the "+1 more" would,
    // so it is shown instead — the reader gets the event, not a count.
    const events = Array.from({ length: 6 }, (_, i) => timed(`e${i}`, `Event ${i}`))
    render(<DayCell {...baseProps} events={events} maxEvents={5} />)
    for (let i = 0; i < 6; i++) expect(screen.getByText(`Event ${i}`)).toBeInTheDocument()
    expect(screen.queryByText(/more/)).not.toBeInTheDocument()
  })

  it('respects a tighter maxEvents for shorter grids', () => {
    const events = Array.from({ length: 4 }, (_, i) => timed(`e${i}`, `Event ${i}`))
    render(<DayCell {...baseProps} events={events} maxEvents={2} />)
    expect(screen.getByText('Event 0')).toBeInTheDocument()
    expect(screen.getByText('Event 1')).toBeInTheDocument()
    expect(screen.queryByText('Event 2')).not.toBeInTheDocument()
    expect(screen.getByText('+2 more')).toBeInTheDocument()
  })

  it('does not print a bare "+N more" when banner lanes leave no room for a chip', () => {
    // The reported bug: when a week's banner lanes consume the whole chip
    // budget (visibleCap 0) a cell rendered no pill but still claimed hidden
    // events, reading as an empty day with an inexplicable "+N more".
    const events = Array.from({ length: 2 }, (_, i) => timed(`e${i}`, `Event ${i}`))
    render(<DayCell {...baseProps} events={events} maxEvents={1} lanes={1} />)
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.queryByText(/more/)).not.toBeInTheDocument()
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
    render(
      <DayCell
        {...baseProps}
        date={new Date(2026, 3, 26)}
        isCurrentMonth={false}
        isFirstCellOfGrid
      />,
    )
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

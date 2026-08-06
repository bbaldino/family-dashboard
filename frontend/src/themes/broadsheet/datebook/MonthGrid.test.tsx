import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MonthGrid } from './MonthGrid'
import type { CalendarEvent } from '@/integrations/google-calendar'

const allDay = (id: string, summary: string, date: string): CalendarEvent => ({
  id,
  summary,
  start: { date },
  end: { date },
})

const timed = (id: string, summary: string, date: string): CalendarEvent => ({
  id,
  summary,
  start: { dateTime: `${date}T16:00:00-07:00` },
  end: { dateTime: `${date}T16:30:00-07:00` },
})

describe('MonthGrid', () => {
  it('renders the weekday header', () => {
    render(<MonthGrid year={2026} month={4} byDate={{}} />)
    for (const label of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('renders as a designed page with an empty month — nothing throws, header still renders', () => {
    // ?scenario=empty: a month with no events at all.
    expect(() => render(<MonthGrid year={2026} month={4} byDate={{}} />)).not.toThrow()
    expect(screen.getByText('Sun')).toBeInTheDocument()
  })

  it('looks up each day by its own YYYY-MM-DD key', () => {
    render(
      <MonthGrid
        year={2026}
        month={4}
        byDate={{ '2026-05-03': [allDay('bd', "Andi Wilson's birthday", '2026-05-03')] }}
      />,
    )
    expect(screen.getByText("Andi Wilson's birthday")).toBeInTheDocument()
  })

  it('renders a multi-day event on every day it spans, including across the month boundary', () => {
    // ?scenario=spanning shape: the same event object present on several
    // consecutive dateKeys, exactly how useMonthCalendar expands it.
    const spanning = allDay('trip', 'Grandma visiting', '2026-04-30')
    render(
      <MonthGrid
        year={2026}
        month={4}
        byDate={{
          '2026-04-30': [spanning],
          '2026-05-01': [spanning],
        }}
      />,
    )
    expect(screen.getAllByText('Grandma visiting')).toHaveLength(2)
  })

  it('renders exactly as many week rows as the month needs, not a hardcoded six', () => {
    // February 2026 needs only four weeks — see month-grid-dates.test.ts.
    render(<MonthGrid year={2026} month={1} byDate={{}} />)
    expect(screen.getAllByTestId('month-grid-week')).toHaveLength(4)
  })

  it('renders six week rows for a month that needs the full grid', () => {
    render(<MonthGrid year={2026} month={4} byDate={{}} />)
    expect(screen.getAllByTestId('month-grid-week')).toHaveLength(6)
  })

  it('uses a tighter per-cell event cap for a six-row month than a four-row one', () => {
    // Verified live at 1600x900 (see MonthGrid.tsx's maxEventsForWeekCount
    // comment): a six-row month's cell can only safely fit 2 events before
    // "+N more"; a four-row month's can fit 4. Three events on one day
    // should collapse in the tighter grid but render in full in the roomier
    // one.
    const events = [
      timed('e0', 'Event 0', '2026-05-14'),
      timed('e1', 'Event 1', '2026-05-14'),
      timed('e2', 'Event 2', '2026-05-14'),
    ]
    const { unmount } = render(
      <MonthGrid year={2026} month={4} byDate={{ '2026-05-14': events }} />,
    )
    expect(screen.queryByText('Event 2')).not.toBeInTheDocument()
    expect(screen.getByText('+1 more')).toBeInTheDocument()
    unmount()

    // February 2026 needs only four weeks.
    render(<MonthGrid year={2026} month={1} byDate={{ '2026-02-14': events }} />)
    expect(screen.getByText('Event 2')).toBeInTheDocument()
    expect(screen.queryByText(/more/)).not.toBeInTheDocument()
  })
})

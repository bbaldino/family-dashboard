import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MonthGrid } from './MonthGrid'
import type { CalendarEvent } from '@/providers/google-calendar'

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

  it('falls back to a chip per day when no spans are supplied', () => {
    // `spans` is optional, and without it the grid renders `byDate` exactly as
    // it finds it. Worth pinning: `byDate` still carries multi-day events for
    // the grid theme and the tally, so this is the path that would silently
    // resurrect duplicate chips if the spans prop were ever dropped upstream.
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

  it('draws a multi-day event as one banner instead of a chip in every cell', () => {
    const spanning = allDay('trip', 'Grandma visiting', '2026-04-30')
    render(
      <MonthGrid
        year={2026}
        month={4}
        byDate={{ '2026-04-30': [spanning], '2026-05-01': [spanning] }}
        spans={[{ event: spanning, startKey: '2026-04-30', endKey: '2026-05-01' }]}
      />,
    )
    expect(screen.getAllByTestId('span-banner')).toHaveLength(1)
    // Once, in the banner — not once per day it covers.
    expect(screen.getAllByText(/Grandma visiting/)).toHaveLength(1)
  })

  it('splits a span across a week boundary and marks the continuation', () => {
    // 9 May 2026 is a Saturday, 10 May the Sunday after, so this crosses a row.
    const ted = allDay('ted', 'Ted in town', '2026-05-09')
    render(
      <MonthGrid
        year={2026}
        month={4}
        byDate={{ '2026-05-09': [ted], '2026-05-10': [ted] }}
        spans={[{ event: ted, startKey: '2026-05-09', endKey: '2026-05-10' }]}
      />,
    )
    expect(screen.getAllByTestId('span-banner')).toHaveLength(2)
    // The second row's piece says what it is rather than repeating bare.
    expect(screen.getByText(/cont\./)).toBeInTheDocument()
  })

  it('does not steal a chip slot from a day no banner crosses', () => {
    // May 2026 is a six-row month: a cell shows 2 chips before "+N more" (3
    // fit via the lone-overflow absorb). A banner over Mon–Tue must reserve
    // its lane only on the cells it crosses — Thursday's three events all
    // still fit. Reserving the whole row's lane count on every cell (the old
    // behaviour) collapsed this unrelated day and sank a lone chip to the
    // bottom of an otherwise-empty cell.
    const trip = allDay('trip', 'Baltimore & Boston', '2026-05-04')
    const byDate = {
      '2026-05-04': [trip],
      '2026-05-05': [trip],
      '2026-05-07': [
        timed('a', 'Event A', '2026-05-07'),
        timed('b', 'Event B', '2026-05-07'),
        timed('c', 'Event C', '2026-05-07'),
      ],
    }
    render(
      <MonthGrid
        year={2026}
        month={4}
        byDate={byDate}
        spans={[{ event: trip, startKey: '2026-05-04', endKey: '2026-05-05' }]}
      />,
    )
    // Thursday is untouched by the Mon–Tue banner: all three fit, no overflow.
    expect(screen.queryByText(/\+\d+ more/)).toBeNull()
    expect(screen.getByText('Event C')).toBeInTheDocument()
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
    // comment): a six-row month's cell safely fits 2 chips before "+N more";
    // a four-row month's fits 5. Five events on one day should collapse in
    // the tighter grid but render in full in the roomier one.
    const events = Array.from({ length: 5 }, (_, i) => timed(`e${i}`, `Event ${i}`, '2026-05-14'))
    const { unmount } = render(
      <MonthGrid year={2026} month={4} byDate={{ '2026-05-14': events }} />,
    )
    expect(screen.queryByText('Event 4')).not.toBeInTheDocument()
    expect(screen.getByText('+3 more')).toBeInTheDocument()
    unmount()

    // February 2026 needs only four weeks — all five render in full.
    const febEvents = Array.from({ length: 5 }, (_, i) => timed(`f${i}`, `Feb ${i}`, '2026-02-14'))
    render(<MonthGrid year={2026} month={1} byDate={{ '2026-02-14': febEvents }} />)
    expect(screen.getByText('Feb 4')).toBeInTheDocument()
    expect(screen.queryByText(/more/)).not.toBeInTheDocument()
  })
})

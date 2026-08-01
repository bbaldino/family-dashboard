import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EventPill } from './EventPill'
import type { CalendarEvent } from '@/data/google-calendar'

describe('EventPill', () => {
  it('renders an all-day event without a time', () => {
    render(
      <EventPill
        event={{ id: 'e1', summary: "Andi Wilson's birthday", start: { date: '2026-05-03' }, end: { date: '2026-05-04' } }}
      />,
    )
    expect(screen.getByText("Andi Wilson's birthday")).toBeInTheDocument()
    expect(screen.queryByText(/ALL DAY/)).not.toBeInTheDocument()
  })

  it('renders a timed event with its start time', () => {
    render(
      <EventPill
        event={{
          id: 'e2',
          summary: 'Piano lesson',
          start: { dateTime: '2026-05-08T16:00:00-07:00' },
          end: { dateTime: '2026-05-08T16:45:00-07:00' },
        }}
      />,
    )
    expect(screen.getByText('Piano lesson')).toBeInTheDocument()
    expect(screen.getByText('4:00 PM')).toBeInTheDocument()
  })

  it('falls back to "Untitled" for an event with no summary', () => {
    render(<EventPill event={{ id: 'e3', start: { date: '2026-05-03' }, end: { date: '2026-05-04' } } as CalendarEvent} />)
    expect(screen.getByText('Untitled')).toBeInTheDocument()
  })

  it('renders a bday-shaped all-day event identically to any other all-day event', () => {
    // Per the design brief: the mock's "bday" kind renders identically to
    // "allday" — only the Tally distinguishes birthdays. There is no
    // separate bday branch in EventPill to test.
    const { container: bday } = render(
      <EventPill event={{ id: 'b1', summary: "Erik Hayden's birthday", start: { date: '2026-05-03' }, end: { date: '2026-05-04' } }} />,
    )
    const { container: allDay } = render(
      <EventPill event={{ id: 'a1', summary: 'School photo day', start: { date: '2026-05-03' }, end: { date: '2026-05-04' } }} />,
    )
    expect(bday.firstElementChild?.tagName).toBe(allDay.firstElementChild?.tagName)
  })
})

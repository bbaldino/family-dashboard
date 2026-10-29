import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { CalendarEvent } from '@/providers/google-calendar'
import { DaySheet } from './DaySheet'

const DAY = new Date(2026, 9, 14)

const events: CalendarEvent[] = [
  {
    id: 'trash',
    summary: 'Trash pickup',
    start: { date: '2026-10-14' },
    end: { date: '2026-10-15' },
  },
  {
    id: 'dentist',
    summary: 'Dentist — Mia',
    start: { dateTime: '2026-10-14T09:00:00' },
    end: { dateTime: '2026-10-14T09:45:00' },
    location: 'Riverside Pediatric Dental',
  },
  {
    id: 'club',
    summary: 'Book club',
    start: { dateTime: '2026-10-14T19:00:00' },
    end: { dateTime: '2026-10-14T20:30:00' },
  },
]

function renderSheet(onClose = vi.fn()) {
  render(<DaySheet date={DAY} events={events} onClose={onClose} />)
  return onClose
}

describe('DaySheet', () => {
  it('names the day and how many events it holds', () => {
    renderSheet()
    const dialog = screen.getByRole('dialog', { name: 'October 14th' })
    expect(within(dialog).getByText('Wednesday · 3 events')).toBeInTheDocument()
  })

  it('lists every event, in the order given, with its time', () => {
    renderSheet()
    const rows = screen.getAllByTestId('day-sheet-event')
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Trash pickup'),
      expect.stringContaining('Dentist — Mia'),
      expect.stringContaining('Book club'),
    ])
    expect(rows[0]).toHaveTextContent(/all day/i)
    expect(rows[1]).toHaveTextContent('9:00')
  })

  it('gives a timed event its length and place', () => {
    renderSheet()
    const [, dentist, club] = screen.getAllByTestId('day-sheet-event')
    expect(dentist).toHaveTextContent('45 min · Riverside Pediatric Dental')
    expect(club).toHaveTextContent('1 hr 30 min')
  })

  it('says "1 event" rather than "1 events"', () => {
    render(<DaySheet date={DAY} events={events.slice(0, 1)} onClose={vi.fn()} />)
    expect(screen.getByText('Wednesday · 1 event')).toBeInTheDocument()
  })

  it('closes from the close button, the backdrop, and Escape', () => {
    const onClose = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    fireEvent.click(screen.getByTestId('day-sheet-backdrop'))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('stays open when the card itself is tapped', () => {
    const onClose = renderSheet()
    fireEvent.click(screen.getByText('Book club'))
    expect(onClose).not.toHaveBeenCalled()
  })
})

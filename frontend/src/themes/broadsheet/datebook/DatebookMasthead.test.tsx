import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DatebookMasthead } from './DatebookMasthead'

function renderMasthead(overrides: Partial<Parameters<typeof DatebookMasthead>[0]> = {}) {
  return render(
    <DatebookMasthead
      year={2026}
      month={4}
      onPrevMonth={vi.fn()}
      onNextMonth={vi.fn()}
      tally={{ eventCount: 0, birthdayCount: 0 }}
      standfirst="Nothing on the calendar this month."
      now={new Date(2026, 4, 23)}
      {...overrides}
    />,
  )
}

describe('DatebookMasthead', () => {
  it('shows the displayed month as the centrepiece', () => {
    renderMasthead()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('May 2026')
  })

  /**
   * The suite-wide masthead rule: the centre names or states the page, both
   * ears carry live data, and no ear is a second name. This ear used to read
   * "The Datebook" — a label for a screen the centre and the nav tab both
   * already identified, and the only thing in the masthead that never
   * changed. Asserting the *absence* is the point: "Browse" alone would pass
   * with the old label sitting beside it.
   */
  it('labels the nav ear as a control, not with the screen name', () => {
    renderMasthead()
    expect(screen.getByText('Browse')).toBeInTheDocument()
    expect(screen.queryByText(/The Datebook/i)).not.toBeInTheDocument()
  })

  it('shows the flanking months in the nav row', () => {
    renderMasthead()
    expect(screen.getByText('April 2026 · June 2026')).toBeInTheDocument()
  })

  it('calls onPrevMonth and onNextMonth from the nav buttons', () => {
    const onPrevMonth = vi.fn()
    const onNextMonth = vi.fn()
    renderMasthead({ onPrevMonth, onNextMonth })
    fireEvent.click(screen.getByRole('button', { name: /previous month/i }))
    fireEvent.click(screen.getByRole('button', { name: /next month/i }))
    expect(onPrevMonth).toHaveBeenCalledTimes(1)
    expect(onNextMonth).toHaveBeenCalledTimes(1)
  })

  it('shows the event count in the Tally', () => {
    renderMasthead({ tally: { eventCount: 62, birthdayCount: 0 } })
    expect(screen.getByText('62')).toBeInTheDocument()
    expect(screen.getByText(/events/)).toBeInTheDocument()
  })

  it('omits the birthday count entirely when it is zero, rather than printing "0 birthdays"', () => {
    renderMasthead({ tally: { eventCount: 40, birthdayCount: 0 } })
    expect(screen.queryByText(/birthdays/)).not.toBeInTheDocument()
  })

  it('shows the birthday count when there is at least one', () => {
    renderMasthead({ tally: { eventCount: 40, birthdayCount: 3 } })
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText(/birthdays/)).toBeInTheDocument()
  })

  it('never renders a flights figure — there is no data source for it', () => {
    renderMasthead({ tally: { eventCount: 40, birthdayCount: 3 } })
    expect(screen.queryByText(/flights/i)).not.toBeInTheDocument()
  })

  it('renders the standfirst prose', () => {
    renderMasthead({ standfirst: 'The last day of school sits 13 days out.' })
    expect(screen.getByText(/The last day of school sits 13 days out\./)).toBeInTheDocument()
  })

  it("renders today's weekday and ordinal date in the standfirst's right-hand line", () => {
    renderMasthead({ now: new Date(2026, 4, 23) })
    expect(screen.getByText(/Today · Saturday 23rd/)).toBeInTheDocument()
  })
})

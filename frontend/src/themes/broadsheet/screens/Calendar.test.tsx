import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { Calendar } from './Calendar'

const useMonthCalendar = vi.hoisted(() => vi.fn())
vi.mock('@/integrations/google-calendar', () => ({ useMonthCalendar }))
const useCountdowns = vi.hoisted(() => vi.fn())
vi.mock('@/integrations/countdowns', () => ({ useCountdowns }))

describe('broadsheet Calendar (the Datebook)', () => {
  beforeEach(() => {
    useCountdowns.mockReturnValue({ data: null, isLoading: false })
  })

  it('renders the full page with every data source empty', () => {
    // Cold-cache boot state — usePolling's data is null until the first
    // fetch resolves.
    useMonthCalendar.mockReturnValue({ data: null, isLoading: true })
    render(<Calendar />)
    expect(screen.getByTestId('broadsheet-calendar')).toBeInTheDocument()
  })

  it('fills the design canvas exactly', () => {
    useMonthCalendar.mockReturnValue({ data: null, isLoading: true })
    render(<Calendar />)
    const root = screen.getByTestId('broadsheet-calendar')
    expect(root.className).toContain('w-[1600px]')
    expect(root.className).toContain('h-[900px]')
  })

  it('renders the weekday header even for an empty month', () => {
    useMonthCalendar.mockReturnValue({ data: { byDate: {} }, isLoading: false })
    render(<Calendar />)
    expect(screen.getByText('Sun')).toBeInTheDocument()
  })

  it('navigates to the previous and next month on nav clicks', () => {
    useMonthCalendar.mockReturnValue({ data: { byDate: {} }, isLoading: false })
    render(<Calendar />)
    const heading = screen.getByRole('heading', { level: 1 })
    const initialMonth = heading.textContent

    fireEvent.click(screen.getByRole('button', { name: /previous month/i }))
    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toBe(initialMonth)

    fireEvent.click(screen.getByRole('button', { name: /next month/i }))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(initialMonth)
  })

  it('accumulates several nav clicks landing in the same batch, rather than net-ing out to one', () => {
    // Regression test: `goToPrevMonth`/`goToNextMonth` used to read `year`/
    // `month` from the closure and call `setDisplayed` with a plain value,
    // so several clicks batched into one React update (plausible on a
    // touchscreen kiosk with no debounce) all computed from the same stale
    // state and collapsed to a single month of movement. Firing the button
    // five times inside one `act()` reproduces a same-batch burst; the fix
    // is the functional `setDisplayed` form, which always sees the latest
    // state regardless of batching.
    useMonthCalendar.mockReturnValue({ data: { byDate: {} }, isLoading: false })
    render(<Calendar />)
    const initialMonth = screen.getByRole('heading', { level: 1 }).textContent
    const today = new Date()
    const expected = new Date(today.getFullYear(), today.getMonth() - 5, 1)
    const expectedMonth = expected.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    const prevButton = screen.getByRole('button', { name: /previous month/i })
    act(() => {
      for (let i = 0; i < 5; i++) fireEvent.click(prevButton)
    })

    const finalMonth = screen.getByRole('heading', { level: 1 }).textContent
    expect(finalMonth).not.toBe(initialMonth)
    expect(finalMonth).toBe(expectedMonth)
  })

  it('re-fetches the month when navigating — useMonthCalendar is called with the newly displayed year/month', () => {
    useMonthCalendar.mockReturnValue({ data: { byDate: {} }, isLoading: false })
    render(<Calendar />)
    useMonthCalendar.mockClear()

    fireEvent.click(screen.getByRole('button', { name: /next month/i }))
    expect(useMonthCalendar).toHaveBeenCalled()
    const [year, month] = useMonthCalendar.mock.calls.at(-1)!
    const today = new Date()
    const expected = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    expect(year).toBe(expected.getFullYear())
    expect(month).toBe(expected.getMonth())
  })

  it('omits the birthday tally figure when the month has none', () => {
    useMonthCalendar.mockReturnValue({
      data: {
        byDate: {
          [todayKey()]: [
            {
              id: 'e1',
              summary: 'Errand',
              start: { dateTime: new Date().toISOString() },
              end: { dateTime: new Date().toISOString() },
            },
          ],
        },
      },
      isLoading: false,
    })
    render(<Calendar />)
    expect(screen.queryByText(/birthdays/)).not.toBeInTheDocument()
  })

  it('shows a birthday tally figure when an all-day event ends in "\'s birthday"', () => {
    const key = todayKey()
    useMonthCalendar.mockReturnValue({
      data: {
        byDate: {
          [key]: [
            {
              id: 'bd1',
              summary: "Andi Wilson's birthday",
              start: { date: key },
              end: { date: key },
            },
          ],
        },
      },
      isLoading: false,
    })
    render(<Calendar />)
    expect(screen.getByText(/birthdays/)).toBeInTheDocument()
  })

  it('never renders a flights figure', () => {
    useMonthCalendar.mockReturnValue({ data: { byDate: {} }, isLoading: false })
    render(<Calendar />)
    expect(screen.queryByText(/flights/i)).not.toBeInTheDocument()
  })
})

function todayKey(): string {
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

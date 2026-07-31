import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HouseholdColumn } from './HouseholdColumn'

const useCountdowns = vi.hoisted(() => vi.fn())
const useOnThisDay = vi.hoisted(() => vi.fn())
const useChores = vi.hoisted(() => vi.fn())
const useLunchMenu = vi.hoisted(() => vi.fn())
vi.mock('@/data/countdowns', () => ({ useCountdowns }))
vi.mock('@/data/on-this-day', () => ({ useOnThisDay }))
vi.mock('@/data/chores', () => ({ useChores }))
vi.mock('@/data/nutrislice', () => ({ useLunchMenu }))

describe('HouseholdColumn', () => {
  beforeEach(() => {
    // useCountdowns: UsePollingResult<CountdownItem[]> — data is the array
    // directly (or null), not { items: [...] }.
    useCountdowns.mockReturnValue({ data: null, isLoading: false, error: null, refetch: vi.fn() })
    // useOnThisDay: plain react-query result; data is OnThisDayData | undefined.
    useOnThisDay.mockReturnValue({ data: undefined, isLoading: false })
    // useChores: data is TodayResponse | null (persons/completed_count/total_count).
    useChores.mockReturnValue({ data: null, isLoading: false })
    // useLunchMenu: UsePollingResult<LunchMenuData>; data.today is a LunchMenuDay | null.
    useLunchMenu.mockReturnValue({ data: null, isLoading: false })
  })

  it('renders with every source empty', () => {
    expect(() => render(<HouseholdColumn />)).not.toThrow()
  })

  it('renders nothing when every source is empty, rather than an empty shell', () => {
    const { container } = render(<HouseholdColumn />)
    expect(container.firstChild).toBeNull()
  })

  it('shows a countdown when there is one', () => {
    useCountdowns.mockReturnValue({
      data: [{ id: '1', name: 'Hawaii', date: new Date('2026-08-17'), daysUntil: 18 }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<HouseholdColumn />)
    expect(screen.getByText(/Hawaii/)).toBeInTheDocument()
  })

  it('stacks sections lunch, chores, coming up, on this day in that order', () => {
    useLunchMenu.mockReturnValue({
      data: { today: { entries: [{ name: 'Pizza' }], extras: [] } },
      isLoading: false,
    })
    useChores.mockReturnValue({ data: { completed_count: 1, total_count: 3 }, isLoading: false })
    useCountdowns.mockReturnValue({
      data: [{ id: '1', name: 'Hawaii', date: new Date('2026-08-17'), daysUntil: 18 }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    useOnThisDay.mockReturnValue({
      data: { events: [{ year: 1980, text: 'Pac-Man begins location testing.' }] },
      isLoading: false,
    })
    render(<HouseholdColumn />)
    const labels = screen.getAllByText(/^(Lunch|Chores today|Coming up|On this day)$/).map((el) => el.textContent)
    expect(labels).toEqual(['Lunch', 'Chores today', 'Coming up', 'On this day'])
  })

  it('does not render a now-playing section — that moved to the footer', () => {
    useLunchMenu.mockReturnValue({
      data: { today: { entries: [{ name: 'Pizza' }], extras: [] } },
      isLoading: false,
    })
    render(<HouseholdColumn />)
    expect(screen.queryByText(/now playing/i)).toBeNull()
  })
})

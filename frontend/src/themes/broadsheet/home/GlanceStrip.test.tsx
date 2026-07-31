import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GlanceStrip } from './GlanceStrip'

const useCountdowns = vi.hoisted(() => vi.fn())
const useOnThisDay = vi.hoisted(() => vi.fn())
const useChores = vi.hoisted(() => vi.fn())
const useLunchMenu = vi.hoisted(() => vi.fn())
const useMusic = vi.hoisted(() => vi.fn())
vi.mock('@/data/countdowns', () => ({ useCountdowns }))
vi.mock('@/data/on-this-day', () => ({ useOnThisDay }))
vi.mock('@/data/chores', () => ({ useChores }))
vi.mock('@/data/nutrislice', () => ({ useLunchMenu }))
vi.mock('@/data/music', () => ({ useMusic }))

describe('GlanceStrip', () => {
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
    // useMusic: returns MusicContextValue directly (not wrapped in query state).
    useMusic.mockReturnValue({ state: { queues: [], activeQueue: null } })
  })

  it('renders with every source empty', () => {
    expect(() => render(<GlanceStrip />)).not.toThrow()
  })

  it('shows a countdown when there is one', () => {
    useCountdowns.mockReturnValue({
      data: [{ id: '1', name: 'Hawaii', date: new Date('2026-08-17'), daysUntil: 18 }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<GlanceStrip />)
    expect(screen.getByText(/Hawaii/)).toBeInTheDocument()
  })

  it('omits the music section when nothing is playing', () => {
    render(<GlanceStrip />)
    expect(screen.queryByText(/now playing/i)).toBeNull()
  })
})

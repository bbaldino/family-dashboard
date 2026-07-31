import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Home } from './Home'

// Mock shapes are derived from the sibling column tests (ScheduleColumn.test.tsx,
// SportsColumn.test.tsx, GlanceStrip.test.tsx, Masthead.test.tsx), which were
// each verified against the real hook source. Several of these differ from a
// naive type-signature guess:
//   - useHeroWeather() returns HeroWeather | null directly, not { data, isLoading }.
//   - useWeatherData() does return the react-query { data, isLoading } shape.
//   - useGoogleCalendar().data is CalendarDay[] directly, not { days: [...] }.
//   - useDrivingTime() returns Record<string, EventDriveInfo> directly, not { data }.
//   - useSportsGames() is the react-query shape; GameState is
//     'live' | 'final' | 'upcoming' | 'postponed', not 'pre'/'in'.
//   - useCountdowns().data is CountdownItem[] directly, not { items: [...] }.
vi.mock('@/data/weather', () => ({
  useHeroWeather: () => null,
  useWeatherData: () => ({ data: undefined, isLoading: true }),
}))
vi.mock('@/data/google-calendar', () => ({ useGoogleCalendar: () => ({ data: undefined, isLoading: true }) }))
vi.mock('@/data/driving-time', () => ({ useDrivingTime: () => ({}) }))
vi.mock('@/data/sports', () => ({
  useSportsGames: () => ({ data: undefined, isLoading: true }),
  useSportsPreview: () => ({ data: undefined }),
  formatUpcomingTime: (s: string) => s,
}))
vi.mock('@/data/countdowns', () => ({
  useCountdowns: () => ({ data: null, isLoading: false, error: null, refetch: vi.fn() }),
}))
vi.mock('@/data/on-this-day', () => ({ useOnThisDay: () => ({ data: undefined, isLoading: false }) }))
vi.mock('@/data/chores', () => ({ useChores: () => ({ data: null, isLoading: false }) }))
vi.mock('@/data/nutrislice', () => ({ useLunchMenu: () => ({ data: null, isLoading: false }) }))
vi.mock('@/data/music', () => ({ useMusic: () => ({ state: { queues: [], activeQueue: null } }) }))

describe('broadsheet Home', () => {
  it('renders the full page with every data source empty', () => {
    // This is the exact state of the tablet for the first second after
    // boot — cold caches everywhere. A crash here means a black wall display.
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('broadsheet-home')).toBeInTheDocument()
  })

  it('fills the design canvas exactly', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )
    const root = screen.getByTestId('broadsheet-home')
    expect(root.className).toContain('w-[1600px]')
    expect(root.className).toContain('h-[900px]')
  })

  it('clips the two-column body instead of letting it spill onto the glance strip', () => {
    // Regression test for the Task 11 hardware finding: with real data the
    // schedule column ran taller than its allotted space and, absent any
    // overflow handling, painted over the glance strip below it. jsdom
    // doesn't compute real layout, so this can't measure pixels — it
    // asserts the structural guarantee instead: the body row must clip
    // (`overflow-hidden`) and must be allowed to shrink to fit
    // (`min-h-0`), both on the row itself and — since it's a grid item's
    // default `min-height: auto` that lets content escape a fixed-height
    // parent in the first place — on the row too as the flex item that
    // sizes it.
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )
    const body = screen.getByTestId('broadsheet-home-body')
    expect(body.className).toContain('overflow-hidden')
    expect(body.className).toContain('min-h-0')
  })
})

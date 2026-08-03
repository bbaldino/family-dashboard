import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Home } from './Home'
import type { GamesResponse, GameState } from '@/data/sports'

// Mock shapes are derived from the sibling column tests (ScheduleColumn.test.tsx,
// SportsColumn.test.tsx, HouseholdColumn.test.tsx, Masthead.test.tsx), which were
// each verified against the real hook source. Several of these differ from a
// naive type-signature guess:
//   - useHeroWeather() returns HeroWeather | null directly, not { data, isLoading }.
//   - useWeatherData() does return the react-query { data, isLoading } shape.
//   - useGoogleCalendar().data is CalendarDay[] directly, not { days: [...] }.
//   - useDrivingTime() returns Record<string, EventDriveInfo> directly, not { data }.
//   - useSportsGames() is the react-query shape; GameState is
//     'live' | 'final' | 'upcoming' | 'postponed', not 'pre'/'in'.
//   - useCountdowns().data is CountdownItem[] directly, not { items: [...] }.
//   - useWeatherForecast()/useAirQuality() are also usePolling's
//     { data, isLoading } shape (WeatherStrip's forecast/air-quality hooks).
vi.mock('@/data/weather', () => ({
  useHeroWeather: () => null,
  useWeatherData: () => ({ data: undefined, isLoading: true }),
  useWeatherForecast: () => ({ data: undefined, isLoading: true }),
  useAirQuality: () => ({ data: undefined, isLoading: true }),
}))
vi.mock('@/data/google-calendar', () => ({
  useGoogleCalendar: () => ({ data: undefined, isLoading: true }),
}))
vi.mock('@/data/driving-time', () => ({ useDrivingTime: () => ({}) }))
const useSportsGames = vi.hoisted(() =>
  vi.fn<() => { data: GamesResponse | undefined; isLoading: boolean }>(() => ({
    data: undefined,
    isLoading: true,
  })),
)
vi.mock('@/data/sports', () => ({
  useSportsGames,
  useSportsPreview: () => ({ data: undefined }),
  formatUpcomingTime: (s: string) => s,
}))
vi.mock('@/data/countdowns', () => ({
  useCountdowns: () => ({ data: null, isLoading: false, error: null, refetch: vi.fn() }),
}))
vi.mock('@/data/on-this-day', () => ({
  useOnThisDay: () => ({ data: undefined, isLoading: false }),
}))
vi.mock('@/data/chores', () => ({ useChores: () => ({ data: null, isLoading: false }) }))
vi.mock('@/data/nutrislice', () => ({ useLunchMenu: () => ({ data: null, isLoading: false }) }))

const team = (abbreviation: string, score: number | null) => ({
  id: abbreviation,
  name: abbreviation,
  abbreviation,
  logo: '',
  record: '31-19',
  score,
  winner: null,
  color: '005A9C',
  altColor: 'ffffff',
  hits: 7,
  errors: 0,
})

// Real GameState values are 'live' | 'final' | 'upcoming' | 'postponed' (see
// src/data/sports/types.ts).
const game = (state: GameState) => ({
  id: 'g1',
  league: 'MLB',
  state,
  name: 'LAD @ MIL',
  startTime: '2026-05-22T16:40:00-07:00',
  venue: null,
  broadcast: 'MLB.TV',
  playoffRound: null,
  home: team('MIL', state === 'upcoming' ? null : 3),
  away: team('LAD', state === 'upcoming' ? null : 4),
  clock: null,
  period: 7,
  periodLabel: 'BOT 7',
  leaders: [],
  allLeaders: [],
  situation: null,
  lastPlay: null,
  headline: null,
  linescores: [],
  athletes: [],
  espnUrl: null,
  liveDetail: null,
})

describe('broadsheet Home', () => {
  beforeEach(() => {
    useSportsGames.mockClear()
    useSportsGames.mockReturnValue({ data: undefined, isLoading: true })
  })

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

  it('clips the three-column body instead of letting it spill under the footer', () => {
    // Regression test for the Task 11 hardware finding: with real data the
    // schedule column ran taller than its allotted space and, absent any
    // overflow handling, painted over content below it. jsdom doesn't
    // compute real layout, so this can't measure pixels — it asserts the
    // structural guarantee instead: the body row must clip
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

  it('opens exactly one sports SSE connection for the whole page', () => {
    // useSportsGames() opens its own EventSource on top of react-query's
    // polling. Home, SportsColumn, and (when there's no featured game)
    // OffdayBlock all used to call it independently — three permanent
    // connections to the same endpoint on a tablet that never reloads. Home
    // now calls it once and threads the result down as props, so this must
    // hold regardless of which sports state (off-day, pregame, live)
    // renders underneath it.
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )
    expect(useSportsGames).toHaveBeenCalledTimes(1)
  })

  it('widens the sports column and narrows the schedule column when a game is live', () => {
    // The concrete behaviour the Phase 4 plan dropped: the body's column
    // ratios re-proportion around a live game (design mock,
    // broadsheet-v2.jsx:139). Off-day/pregame favours the schedule
    // (1.5fr 1fr 0.9fr); live, sports blooms to 1.6fr and schedule shrinks
    // to 0.85fr.
    useSportsGames.mockReturnValue({
      data: { games: [game('upcoming')], hasLive: false },
      isLoading: false,
    })
    const { unmount } = render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )
    const offdayBody = screen.getByTestId('broadsheet-home-body')
    expect(offdayBody.style.gridTemplateColumns).toBe('1.15fr 1fr 1.2fr')
    unmount()

    useSportsGames.mockReturnValue({
      data: { games: [game('live')], hasLive: true },
      isLoading: false,
    })
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )
    const liveBody = screen.getByTestId('broadsheet-home-body')
    expect(liveBody.style.gridTemplateColumns).toBe('0.8fr 1.5fr 0.95fr')
  })
})

import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useLeagueTeams,
  useLeagueTeamsFetcher,
  useTeamSearch,
  leagueTeamsQueryKey,
} from './useTeams'
import type { TeamInfo } from './types'

/**
 * What's pinned here is the composed URLs (both endpoints wrap their result in
 * `{ teams }`, which the hooks unwrap), the search encoding, and the cache
 * sharing between `useLeagueTeams` and `useLeagueTeamsFetcher` — the fetcher
 * exists so the settings screen's backfill loop can run over a runtime-length
 * list of leagues, and it is only worth having over a bare `api.get` if it
 * lands in the same cache entry the hook reads.
 */

const NBA_TEAMS: TeamInfo[] = [
  {
    id: 'lal',
    name: 'Lakers',
    displayName: 'Los Angeles Lakers',
    abbreviation: 'LAL',
    logo: 'https://cdn.test/lal.png',
    league: 'nba',
  },
]

const SEARCH_TEAMS: TeamInfo[] = [
  {
    id: 'bos-sox',
    name: 'Red Sox',
    displayName: 'Boston Red Sox',
    abbreviation: 'BOS',
    logo: 'https://cdn.test/sox.png',
    league: 'mlb',
  },
]

let requested: string[] = []

function mockFetch(ok = true) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    requested.push(url)
    const body = url.includes('/search') ? { teams: SEARCH_TEAMS } : { teams: NBA_TEAMS }
    const value = ok ? body : { error: 'upstream down' }
    return Promise.resolve({
      ok,
      status: ok ? 200 : 500,
      json: () => Promise.resolve(value),
      text: () => Promise.resolve(JSON.stringify(value)),
    } as Response)
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

function createWrapper(
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return { Wrapper, queryClient }
}

describe('useLeagueTeams', () => {
  beforeEach(() => {
    requested = []
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches /api/sports/teams?league= and unwraps .teams', async () => {
    mockFetch()
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useLeagueTeams('nba'), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.data).toEqual(NBA_TEAMS))
    expect(requested).toEqual(['/api/sports/teams?league=nba'])
  })

  it('fetches nothing while no league is selected', async () => {
    mockFetch()
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useLeagueTeams(null), { wrapper: Wrapper })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(requested).toEqual([])
    expect(result.current.data).toBeUndefined()
    expect(result.current.isFetching).toBe(false)
  })

  it('surfaces a failed fetch as an error rather than an empty roster', async () => {
    mockFetch(false)
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useLeagueTeams('nba'), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })
})

describe('useLeagueTeamsFetcher', () => {
  beforeEach(() => {
    requested = []
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves to the unwrapped roster', async () => {
    mockFetch()
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useLeagueTeamsFetcher(), { wrapper: Wrapper })

    await expect(result.current('nba')).resolves.toEqual(NBA_TEAMS)
    expect(requested).toEqual(['/api/sports/teams?league=nba'])
  })

  it('is stable across renders, so a caller can depend on it', () => {
    mockFetch()
    const { Wrapper } = createWrapper()

    const { result, rerender } = renderHook(() => useLeagueTeamsFetcher(), { wrapper: Wrapper })
    const first = result.current
    rerender()

    expect(result.current).toBe(first)
  })

  it('fills the same cache entry useLeagueTeams reads', async () => {
    mockFetch()
    const { Wrapper, queryClient } = createWrapper()

    const { result: fetcher } = renderHook(() => useLeagueTeamsFetcher(), { wrapper: Wrapper })
    await fetcher.current('nba')

    expect(queryClient.getQueryData(leagueTeamsQueryKey('nba'))).toEqual(NBA_TEAMS)

    // The hook has data on its very first render — no spinner, no waiting.
    // (Not asserting a request count: this client has the default staleTime of
    // 0, so it also revalidates in the background. That's react-query's
    // staleness policy, not this module's, and the app sets staleTime to 60s.)
    const { result } = renderHook(() => useLeagueTeams('nba'), { wrapper: Wrapper })
    expect(result.current.data).toEqual(NBA_TEAMS)
    expect(result.current.isLoading).toBe(false)
  })

  it('rejects on failure so the caller can catch it', async () => {
    mockFetch(false)
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useLeagueTeamsFetcher(), { wrapper: Wrapper })

    await expect(result.current('nba')).rejects.toThrow()
  })
})

describe('useTeamSearch', () => {
  beforeEach(() => {
    requested = []
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('url-encodes the query, including a space and an ampersand', async () => {
    mockFetch()
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useTeamSearch('sox & socks'), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.data).toEqual(SEARCH_TEAMS))
    expect(requested).toEqual(['/api/sports/teams/search?q=sox%20%26%20socks'])
  })

  it('does not fire a request for an empty query', async () => {
    mockFetch()
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useTeamSearch(''), { wrapper: Wrapper })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(requested).toEqual([])
    expect(result.current.data).toBeUndefined()
    expect(result.current.isFetching).toBe(false)
  })

  it('does not fire a request for a single character', async () => {
    mockFetch()
    const { Wrapper } = createWrapper()

    renderHook(() => useTeamSearch('b'), { wrapper: Wrapper })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(requested).toEqual([])
  })

  it('keeps the previous matches on screen while the next query is in flight', async () => {
    mockFetch()
    const { Wrapper } = createWrapper()

    const { result, rerender } = renderHook(({ q }) => useTeamSearch(q), {
      wrapper: Wrapper,
      initialProps: { q: 'sox' },
    })
    await waitFor(() => expect(result.current.data).toEqual(SEARCH_TEAMS))

    rerender({ q: 'soxx' })

    // Not blanked mid-request the way a plain key change would blank it.
    expect(result.current.data).toEqual(SEARCH_TEAMS)
  })

  it('clears the results when the query drops below the threshold', async () => {
    mockFetch()
    const { Wrapper } = createWrapper()

    const { result, rerender } = renderHook(({ q }) => useTeamSearch(q), {
      wrapper: Wrapper,
      initialProps: { q: 'sox' },
    })
    await waitFor(() => expect(result.current.data).toEqual(SEARCH_TEAMS))

    rerender({ q: '' })

    expect(result.current.data).toBeUndefined()
  })
})

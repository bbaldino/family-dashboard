import { describe, expect, it, vi, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePlayerOptions, PLAYERS_QUERY_KEY } from './usePlayers'
import type { RawPlayer } from './usePlayers'

/**
 * `usePlayerOptions` is the settings-side view of the same `/players` cache
 * entry `usePlayers` polls for the player picker. What's pinned here is the
 * three things that differ from the picker's hook — on-demand rather than
 * on-mount, no polling, and camelCase `Player`s rather than the raw wire
 * shape — plus the one thing that must *not* differ: the query key, so the
 * two hooks can never end up issuing two independent `/players` fetches.
 */

const RAW_PLAYERS: RawPlayer[] = [
  {
    player_id: 'kitchen',
    display_name: 'Kitchen',
    state: 'playing',
    available: true,
    volume_level: 45,
    group_members: ['kitchen'],
    synced_to: null,
    can_group_with: ['office'],
    group_volume: null,
  },
  // No `display_name` — normalizePlayer falls back to `name`.
  { player_id: 'office', name: 'Office' },
  // Neither — it falls back to the id itself.
  { player_id: 'patio' },
]

function mockFetch(players: RawPlayer[] | { error: string }, ok = true) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/music/players') {
      return Promise.resolve({
        ok,
        status: ok ? 200 : 500,
        json: () => Promise.resolve(players),
        text: () => Promise.resolve(JSON.stringify(players)),
      } as Response)
    }
    return Promise.reject(new Error(`Unexpected fetch url: ${url}`))
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

describe('usePlayerOptions', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not fetch until triggered', async () => {
    const fetchMock = mockFetch(RAW_PLAYERS)
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => usePlayerOptions(), { wrapper: Wrapper })

    // Let any microtasks that would fire an unwanted mount-time request drain.
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.data).toBeUndefined()
    expect(result.current.isFetching).toBe(false)
  })

  it('fetches /api/music/players once triggered and returns normalized players', async () => {
    const fetchMock = mockFetch(RAW_PLAYERS)
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => usePlayerOptions(), { wrapper: Wrapper })

    result.current.refetch()

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(fetchMock).toHaveBeenCalledWith('/api/music/players', undefined)

    expect(result.current.data?.map((p) => p.playerId)).toEqual(['kitchen', 'office', 'patio'])
    // The display fallback chain lives in normalizePlayer, not in the caller.
    expect(result.current.data?.map((p) => p.displayName)).toEqual(['Kitchen', 'Office', 'patio'])
    expect(result.current.data?.[0].canGroupWith).toEqual(['office'])
  })

  it('does not poll the way the picker hook does', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchMock = mockFetch(RAW_PLAYERS)
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => usePlayerOptions(), { wrapper: Wrapper })
    result.current.refetch()
    await waitFor(() => expect(result.current.data).toBeDefined())

    // Well past usePlayers' 5s picker poll.
    await vi.advanceTimersByTimeAsync(30_000)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shares the players cache entry rather than fetching its own', async () => {
    const fetchMock = mockFetch(RAW_PLAYERS)
    const { Wrapper, queryClient } = createWrapper()
    queryClient.setQueryData(PLAYERS_QUERY_KEY, RAW_PLAYERS)

    const { result } = renderHook(() => usePlayerOptions(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.data).toHaveLength(3))
    expect(result.current.data?.[0].playerId).toBe('kitchen')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('surfaces a failed fetch as an error rather than an empty list', async () => {
    mockFetch({ error: 'connection refused' }, false)
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => usePlayerOptions(), { wrapper: Wrapper })

    result.current.refetch()

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// This file tests the *wiring* between the music query hooks and the
// scenario fixtures — that a defined fixture short-circuits the fetch, and
// an undefined one (no scenario, or a scenario this integration doesn't
// define) falls through to the normal fetch path unchanged, with the same
// queryKey/enabled/staleTime as before the lift. Fixture *content* is
// covered by fixtures.test.ts; mocking './fixtures' here lets each case be
// set up directly without depending on `?scenario=`. `MusicProvider`'s own
// scenario wiring (queue state arrives over SSE, not a query) is covered
// separately in MusicProvider.test.tsx.
const {
  musicAlbumDetailFixtureFor,
  musicArtistDetailFixtureFor,
  musicSearchFixtureFor,
  musicTopTracksFixtureFor,
  musicRecentFixtureFor,
  musicForYouFixtureFor,
  musicPlayersFixtureFor,
  musicQueueItemsFixtureFor,
} = vi.hoisted(() => ({
  musicAlbumDetailFixtureFor: vi.fn(),
  musicArtistDetailFixtureFor: vi.fn(),
  musicSearchFixtureFor: vi.fn(),
  musicTopTracksFixtureFor: vi.fn(),
  musicRecentFixtureFor: vi.fn(),
  musicForYouFixtureFor: vi.fn(),
  musicPlayersFixtureFor: vi.fn(),
  musicQueueItemsFixtureFor: vi.fn(),
}))

vi.mock('./fixtures', () => ({
  musicAlbumDetailFixtureFor,
  musicArtistDetailFixtureFor,
  musicSearchFixtureFor,
  musicTopTracksFixtureFor,
  musicRecentFixtureFor,
  musicForYouFixtureFor,
  musicPlayersFixtureFor,
  musicQueueItemsFixtureFor,
}))

// useQueue also depends on useMusic (for the active-track-changed refetch
// trigger) — stub it so this file doesn't need a real MusicProvider.
const useMusic = vi.hoisted(() => vi.fn())
vi.mock('./useMusic', () => ({ useMusic }))

import { useAlbumDetail } from './useAlbumDetail'
import { useArtistDetail } from './useArtistDetail'
import { useSearch } from './useSearch'
import { useTopTracks, useRecentlyPlayed } from './useQuickDials'
import { useForYou } from './useForYou'
import { usePlayers } from './usePlayers'
import { useQueue } from './useQueue'

function mockFetchJson(json: unknown) {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(json)),
    } as Response),
  ) as unknown as typeof fetch
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('music hook scenario wiring', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    for (const fn of [
      musicAlbumDetailFixtureFor,
      musicArtistDetailFixtureFor,
      musicSearchFixtureFor,
      musicTopTracksFixtureFor,
      musicRecentFixtureFor,
      musicForYouFixtureFor,
      musicPlayersFixtureFor,
      musicQueueItemsFixtureFor,
    ]) {
      fn.mockReset()
    }
    useMusic.mockReset()
  })

  it('useAlbumDetail returns the fixture without touching fetch when one is defined', async () => {
    const fixture = {
      name: 'Late Bloom',
      artist: null,
      artist_uri: null,
      image_url: null,
      year: null,
      tracks: [],
    }
    musicAlbumDetailFixtureFor.mockReturnValue(fixture)
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as unknown as typeof fetch

    const { result } = renderHook(() => useAlbumDetail('fixture://album/late-bloom'), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data).toEqual(fixture)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('useAlbumDetail fetches normally when no fixture is defined for the active scenario', async () => {
    musicAlbumDetailFixtureFor.mockReturnValue(undefined)
    mockFetchJson({
      name: 'Real Album',
      artist: null,
      artist_uri: null,
      image_url: null,
      year: null,
      tracks: [],
    })

    const { result } = renderHook(() => useAlbumDetail('spotify://album/1'), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data?.name).toBe('Real Album')
  })

  it('useArtistDetail returns the fixture without touching fetch when one is defined', async () => {
    const fixture = { name: 'The Night Shift', image_url: null, top_tracks: [], albums: [] }
    musicArtistDetailFixtureFor.mockReturnValue(fixture)
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as unknown as typeof fetch

    const { result } = renderHook(() => useArtistDetail('fixture://artist/the-night-shift'), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data).toEqual(fixture)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('useArtistDetail fetches normally when no fixture is defined for the active scenario', async () => {
    musicArtistDetailFixtureFor.mockReturnValue(undefined)
    mockFetchJson({ name: 'Real Artist', image_url: null, top_tracks: [], albums: [] })

    const { result } = renderHook(() => useArtistDetail('spotify://artist/1'), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data?.name).toBe('Real Artist')
  })

  it('useSearch returns the fixture without touching fetch when one is defined, ignoring the query text', async () => {
    const fixture = { tracks: [], artists: [], albums: [], playlists: [] }
    musicSearchFixtureFor.mockReturnValue(fixture)
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as unknown as typeof fetch

    const { result } = renderHook(() => useSearch('anything'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data).toEqual(fixture)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('useSearch fetches and parses normally when no fixture is defined for the active scenario', async () => {
    musicSearchFixtureFor.mockReturnValue(undefined)
    mockFetchJson({ tracks: [{ name: 'Real Track', uri: 'x' }] })

    const { result } = renderHook(() => useSearch('query'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data?.tracks[0].name).toBe('Real Track')
  })

  it('useSearch stays disabled below 2 characters regardless of scenario', () => {
    musicSearchFixtureFor.mockReturnValue({ tracks: [], artists: [], albums: [], playlists: [] })
    const { result } = renderHook(() => useSearch('a'), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })

  it('useTopTracks / useRecentlyPlayed return their fixtures without touching fetch when defined', async () => {
    musicTopTracksFixtureFor.mockReturnValue([])
    musicRecentFixtureFor.mockReturnValue([])
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    const wrapper = createWrapper()

    const top = renderHook(() => useTopTracks(), { wrapper })
    const recent = renderHook(() => useRecentlyPlayed(), { wrapper })
    await waitFor(() => expect(top.result.current.data).toBeDefined())
    await waitFor(() => expect(recent.result.current.data).toBeDefined())

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('useTopTracks / useRecentlyPlayed fetch normally when no fixture is defined', async () => {
    musicTopTracksFixtureFor.mockReturnValue(undefined)
    musicRecentFixtureFor.mockReturnValue(undefined)
    mockFetchJson([])
    const wrapper = createWrapper()

    const top = renderHook(() => useTopTracks(), { wrapper })
    await waitFor(() => expect(top.result.current.data).toBeDefined())
    expect(top.result.current.data).toEqual([])
  })

  it('useForYou returns the fixture without touching fetch when one is defined', async () => {
    musicForYouFixtureFor.mockReturnValue([
      { name: 'Kitchen Radio', description: 'x', uri: 'u', image: null },
    ])
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as unknown as typeof fetch

    const { result } = renderHook(() => useForYou(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data).toHaveLength(1)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('usePlayers returns the fixture without touching fetch when one is defined', async () => {
    musicPlayersFixtureFor.mockReturnValue([{ player_id: 'kitchen' }])
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as unknown as typeof fetch

    const { result } = renderHook(() => usePlayers({ isOpen: true, pollingPaused: false }), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data).toEqual([{ player_id: 'kitchen' }])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('usePlayers stays disabled while the picker is closed, fixture or not', () => {
    musicPlayersFixtureFor.mockReturnValue([{ player_id: 'kitchen' }])
    const { result } = renderHook(() => usePlayers({ isOpen: false, pollingPaused: false }), {
      wrapper: createWrapper(),
    })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('useQueue returns the fixture without touching fetch when one is defined', async () => {
    useMusic.mockReturnValue({ state: { queues: [], activeQueue: null } })
    musicQueueItemsFixtureFor.mockReturnValue([{ media_item: { name: 'Fixture Track', uri: 'u' } }])
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as unknown as typeof fetch

    const { result } = renderHook(() => useQueue('fixture-kitchen'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data).toEqual([{ media_item: { name: 'Fixture Track', uri: 'u' } }])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('useQueue fetches normally when no fixture is defined for the active scenario', async () => {
    useMusic.mockReturnValue({ state: { queues: [], activeQueue: null } })
    musicQueueItemsFixtureFor.mockReturnValue(undefined)
    mockFetchJson([{ media_item: { name: 'Real Track', uri: 'u' } }])

    const { result } = renderHook(() => useQueue('real-queue'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data?.[0].media_item.name).toBe('Real Track')
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Lifted out of grid's PlayerPicker (see useGroupMutations.ts's own header
// comment) and hardened against three defects measured against the real
// service: the cache was patched *after* the POST instead of before, a
// failed POST left the optimistic write in place forever, and a fixed
// 1500ms resume-timer both raced MA's real ~2s convergence and let a second
// overlapping mutation's pause get cancelled early by the first one's own
// timer. These tests exercise all of that entirely against a mocked
// `musicIntegration.api` — no real Sonos endpoint is ever called — see the
// room-grouping brief on why that's a hard constraint, not just a
// test-speed choice. Fake timers drive the confirmation-polling delays so
// the suite doesn't actually wait multiple seconds per test.
const post = vi.hoisted(() => vi.fn())
const get = vi.hoisted(() => vi.fn())
vi.mock('./config', () => ({ musicIntegration: { api: { post, get } } }))

import {
  useGroupMutations,
  CONFIRM_POLL_INTERVAL_MS,
  CONFIRM_POLL_TIMEOUT_MS,
} from './useGroupMutations'

const RAW_PLAYERS_KEY = ['music', 'players']

interface TestPlayer {
  player_id: string
  display_name?: string
  group_members?: string[]
  synced_to?: string | null
  can_group_with?: string[]
  group_volume?: number | null
}

function rawPlayers(): TestPlayer[] {
  return [
    {
      player_id: 'kitchen',
      display_name: 'Kitchen',
      group_members: [],
      can_group_with: ['living', 'bedroom'],
      group_volume: null,
    },
    {
      player_id: 'living',
      display_name: 'Living Room',
      group_members: [],
      can_group_with: ['kitchen'],
    },
    {
      player_id: 'bedroom',
      display_name: 'Bedroom',
      group_members: [],
      can_group_with: ['kitchen'],
    },
  ]
}

/** A players snapshot with the given ids (plus the leader) as the kitchen's
 *  group_members — the shape a *real* /players response would report once
 *  MA has actually converged. */
function kitchenGroupedWith(...ids: string[]): TestPlayer[] {
  return rawPlayers().map((p) =>
    p.player_id === 'kitchen' ? { ...p, group_members: ['kitchen', ...ids] } : p,
  )
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function cacheGroupMembers(queryClient: QueryClient, playerId: string): string[] | undefined {
  return queryClient
    .getQueryData<TestPlayer[]>(RAW_PLAYERS_KEY)
    ?.find((p) => p.player_id === playerId)?.group_members
}

describe('useGroupMutations', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    post.mockReset()
    get.mockReset()
    vi.useRealTimers()
  })

  it('applies the optimistic patch immediately, before the POST resolves', async () => {
    let resolvePost: () => void = () => {}
    post.mockReturnValue(
      new Promise<void>((resolve) => {
        resolvePost = resolve
      }),
    )
    get.mockResolvedValue(kitchenGroupedWith('living'))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(RAW_PLAYERS_KEY, rawPlayers())
    const { result } = renderHook(() => useGroupMutations(), {
      wrapper: createWrapper(queryClient),
    })

    let mutation!: Promise<unknown>
    act(() => {
      mutation = result.current.addToGroup('living', 'kitchen')!
    })

    // The POST is still pending — nothing has resolved yet — but the cache
    // already shows the join. That's the fix: this used to only happen
    // *after* the POST returned, which made every tap look dead for the
    // first ~0.3–0.5s (the measured real POST latency).
    expect(cacheGroupMembers(queryClient, 'kitchen')).toEqual(['kitchen', 'living'])

    resolvePost()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONFIRM_POLL_INTERVAL_MS)
      await mutation
    })
    expect(post).toHaveBeenCalledWith('/group', { player_id: 'living', target_player: 'kitchen' })
  })

  it('addToGroup is a no-op when there is no leader', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useGroupMutations(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.addToGroup('living', null)
    })

    expect(post).not.toHaveBeenCalled()
  })

  it('rolls back to the pre-mutation group_members when the POST rejects', async () => {
    post.mockRejectedValue(new Error('boom'))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(RAW_PLAYERS_KEY, rawPlayers())
    const { result } = renderHook(() => useGroupMutations(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await expect(result.current.addToGroup('living', 'kitchen')).rejects.toThrow('boom')
    })

    // Not just "left as it was mid-mutation" — restored, matching the
    // pre-mutation state exactly. There was previously no rollback at all:
    // a failed POST left the optimistic lie in place until the next poll.
    expect(cacheGroupMembers(queryClient, 'kitchen')).toEqual([])
    expect(result.current.pendingIds.has('living')).toBe(false)
    expect(result.current.pollingPaused).toBe(false)
  })

  it('removeFromGroup posts /ungroup, applies immediately, and collapses to [] once only the leader remains', async () => {
    post.mockResolvedValue({})
    get.mockResolvedValue(kitchenGroupedWith())
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(RAW_PLAYERS_KEY, kitchenGroupedWith('living'))
    const { result } = renderHook(() => useGroupMutations(), {
      wrapper: createWrapper(queryClient),
    })

    let mutation!: Promise<unknown>
    act(() => {
      mutation = result.current.removeFromGroup('living', 'kitchen')
    })
    expect(cacheGroupMembers(queryClient, 'kitchen')).toEqual([])

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONFIRM_POLL_INTERVAL_MS)
      await mutation
    })
    expect(post).toHaveBeenCalledWith('/ungroup', { player_id: 'living' })
  })

  it('removeFromGroup rolls back (re-adds the player) when the POST rejects', async () => {
    post.mockRejectedValue(new Error('boom'))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(RAW_PLAYERS_KEY, kitchenGroupedWith('living'))
    const { result } = renderHook(() => useGroupMutations(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await expect(result.current.removeFromGroup('living', 'kitchen')).rejects.toThrow('boom')
    })

    expect(cacheGroupMembers(queryClient, 'kitchen')).toEqual(['kitchen', 'living'])
  })

  it('does not let a stale (pre-mutation) confirmation response revert the optimistic write', async () => {
    post.mockResolvedValue({})
    // The first two polls still report the pre-mutation state (mirrors the
    // measured fact that MA's players/all lags ~1s behind a landed POST);
    // only the third has converged.
    get
      .mockResolvedValueOnce(rawPlayers())
      .mockResolvedValueOnce(rawPlayers())
      .mockResolvedValueOnce(kitchenGroupedWith('living'))

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(RAW_PLAYERS_KEY, rawPlayers())
    const { result } = renderHook(() => useGroupMutations(), {
      wrapper: createWrapper(queryClient),
    })

    let mutation!: Promise<unknown>
    act(() => {
      mutation = result.current.addToGroup('living', 'kitchen')!
    })

    // Walk through the two stale polls.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONFIRM_POLL_INTERVAL_MS * 2)
    })
    expect(get).toHaveBeenCalledTimes(2)
    // Still shows the optimistic join — a stale response never had a chance
    // to flip it back, because confirmation polling only ever *reads* to
    // decide when to stop, it never writes a fetched snapshot into the cache.
    expect(cacheGroupMembers(queryClient, 'kitchen')).toEqual(['kitchen', 'living'])
    // Pending is a "command in flight" cue, cleared once the POST is accepted
    // — not held for the whole convergence wait, which measured anywhere from
    // ~2s to ~12s on the same speakers. Convergence still governs when
    // polling resumes.
    expect(result.current.pendingIds.has('living')).toBe(false)
    expect(result.current.pollingPaused).toBe(true)

    // The third poll converges and the mutation settles.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONFIRM_POLL_INTERVAL_MS)
      await mutation
    })
    expect(get).toHaveBeenCalledTimes(3)
    expect(cacheGroupMembers(queryClient, 'kitchen')).toEqual(['kitchen', 'living'])
    expect(result.current.pendingIds.has('living')).toBe(false)
  })

  it('gives up after the confirmation bound rather than holding pending/paused forever', async () => {
    post.mockResolvedValue({})
    // Never converges.
    get.mockResolvedValue(rawPlayers())
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(RAW_PLAYERS_KEY, rawPlayers())
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useGroupMutations(), {
      wrapper: createWrapper(queryClient),
    })

    let mutation!: Promise<unknown>
    act(() => {
      mutation = result.current.addToGroup('living', 'kitchen')!
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONFIRM_POLL_TIMEOUT_MS + CONFIRM_POLL_INTERVAL_MS)
      await mutation
    })

    // The optimistic write is still there — abandoning the *wait* isn't the
    // same as rolling back a mutation whose POST actually succeeded — but
    // pending/paused both cleared, and the one real refetch fired so the
    // UI ends up showing whatever MA actually reports next.
    expect(cacheGroupMembers(queryClient, 'kitchen')).toEqual(['kitchen', 'living'])
    expect(result.current.pendingIds.has('living')).toBe(false)
    expect(result.current.pollingPaused).toBe(false)
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
    // Bounded: never poll for confirmation longer than the timeout allows.
    expect(get.mock.calls.length).toBeLessThanOrEqual(
      CONFIRM_POLL_TIMEOUT_MS / CONFIRM_POLL_INTERVAL_MS + 1,
    )
  })

  it('refcounts overlapping mutations — polling resumes, and the refetch fires, only once the last one settles', async () => {
    // Mirrors the reported scenario: a second tap (Deck) landing while a
    // first (Patio) is still settling. Bedroom's poll confirms first (one
    // interval); living's needs a second round — order is what's being
    // proven, not which specific room is slower.
    post.mockResolvedValue({})
    let getCallCount = 0
    get.mockImplementation(async () => {
      getCallCount += 1
      if (getCallCount === 1) return rawPlayers() // living's 1st poll: not yet
      if (getCallCount === 2) return kitchenGroupedWith('bedroom') // bedroom's 1st poll: confirmed
      return kitchenGroupedWith('living', 'bedroom') // living's 2nd poll: confirmed
    })

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(RAW_PLAYERS_KEY, rawPlayers())
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useGroupMutations(), {
      wrapper: createWrapper(queryClient),
    })

    let livingMutation!: Promise<unknown>
    let bedroomMutation!: Promise<unknown>

    act(() => {
      livingMutation = result.current.addToGroup('living', 'kitchen')!
    })
    expect(result.current.pollingPaused).toBe(true)

    act(() => {
      bedroomMutation = result.current.addToGroup('bedroom', 'kitchen')!
    })
    expect(result.current.pollingPaused).toBe(true)
    // Both optimistic writes compose on the same leader row — the second
    // tap didn't clobber the first's.
    expect(cacheGroupMembers(queryClient, 'kitchen')).toEqual(['kitchen', 'living', 'bedroom'])

    // First round of polls: bedroom confirms, living doesn't yet.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONFIRM_POLL_INTERVAL_MS)
      await bedroomMutation
    })
    // Bedroom settled, but living hasn't — polling must still be paused.
    // This is exactly the bug: a shared boolean plus one independent
    // resume-timer per call meant the *first* mutation's timer could
    // un-pause polling while a second was still mid-flight.
    expect(result.current.pollingPaused).toBe(true)
    expect(invalidateSpy).not.toHaveBeenCalled()
    // Both pending cues cleared as soon as their POSTs were accepted; it's
    // the refcount, not pendingIds, that holds polling paused until the last
    // mutation actually converges.
    expect(result.current.pendingIds.has('bedroom')).toBe(false)
    expect(result.current.pendingIds.has('living')).toBe(false)

    // Second round: living confirms too.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONFIRM_POLL_INTERVAL_MS)
      await livingMutation
    })
    expect(result.current.pollingPaused).toBe(false)
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
    expect(cacheGroupMembers(queryClient, 'kitchen')).toEqual(['kitchen', 'living', 'bedroom'])
  })

  it('ungroupAll posts /ungroup for every follower, applies immediately, and rolls back on failure', async () => {
    post.mockResolvedValue({})
    get.mockResolvedValue(kitchenGroupedWith())
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(RAW_PLAYERS_KEY, kitchenGroupedWith('living', 'bedroom'))
    const leader = {
      playerId: 'kitchen',
      displayName: 'Kitchen',
      state: 'playing',
      available: true,
      volumeLevel: 45,
      groupMembers: ['kitchen', 'living', 'bedroom'],
      syncedTo: null,
      canGroupWith: [],
      groupVolume: null,
    }
    const { result } = renderHook(() => useGroupMutations(), {
      wrapper: createWrapper(queryClient),
    })

    let mutation!: Promise<unknown>
    act(() => {
      mutation = result.current.ungroupAll(leader)!
    })
    // Applied immediately, before either POST resolves.
    expect(cacheGroupMembers(queryClient, 'kitchen')).toEqual([])

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONFIRM_POLL_INTERVAL_MS)
      await mutation
    })
    expect(post).toHaveBeenCalledWith('/ungroup', { player_id: 'living' })
    expect(post).toHaveBeenCalledWith('/ungroup', { player_id: 'bedroom' })
  })

  it('ungroupAll rolls back to the previous member list when any of its POSTs reject', async () => {
    post.mockRejectedValue(new Error('boom'))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(RAW_PLAYERS_KEY, kitchenGroupedWith('living', 'bedroom'))
    const leader = {
      playerId: 'kitchen',
      displayName: 'Kitchen',
      state: 'playing',
      available: true,
      volumeLevel: 45,
      groupMembers: ['kitchen', 'living', 'bedroom'],
      syncedTo: null,
      canGroupWith: [],
      groupVolume: null,
    }
    const { result } = renderHook(() => useGroupMutations(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await expect(result.current.ungroupAll(leader)).rejects.toThrow('boom')
    })

    expect(cacheGroupMembers(queryClient, 'kitchen')).toEqual(['kitchen', 'living', 'bedroom'])
  })

  it('ungroupAll is a no-op when there is no leader', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useGroupMutations(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.ungroupAll(null)
    })

    expect(post).not.toHaveBeenCalled()
  })

  it('setGroupVolume posts /group-volume, applies immediately, and participates in the same pause/refetch protocol', async () => {
    post.mockResolvedValue({})
    get.mockResolvedValue(
      rawPlayers().map((p) => (p.player_id === 'kitchen' ? { ...p, group_volume: 30 } : p)),
    )
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(
      RAW_PLAYERS_KEY,
      rawPlayers().map((p) => (p.player_id === 'kitchen' ? { ...p, group_volume: 50 } : p)),
    )
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useGroupMutations(), {
      wrapper: createWrapper(queryClient),
    })

    let mutation!: Promise<unknown>
    act(() => {
      mutation = result.current.setGroupVolume('kitchen', 30)!
    })
    expect(result.current.pollingPaused).toBe(true)
    expect(
      queryClient
        .getQueryData<TestPlayer[]>(RAW_PLAYERS_KEY)
        ?.find((p) => p.player_id === 'kitchen')?.group_volume,
    ).toBe(30)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONFIRM_POLL_INTERVAL_MS)
      await mutation
    })
    expect(post).toHaveBeenCalledWith('/group-volume', { player_id: 'kitchen', level: 30 })
    expect(result.current.pollingPaused).toBe(false)
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
  })

  it("moves the follower's synced_to as well as the leader's group_members", async () => {
    // Membership is read as `leader.group_members.includes(id) || player.synced_to === leaderId`
    // (useRoomPills.isJoinedToAnchor). Patching only the leader left a removal
    // still reading as joined off the follower's stale synced_to, so the pill
    // didn't move until the real refetch landed ~2s later — the exact
    // "nothing happens for a long while" that was reported on removal.
    post.mockResolvedValue({})
    get.mockResolvedValue(rawPlayers())
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(
      RAW_PLAYERS_KEY,
      kitchenGroupedWith('living').map((p) =>
        p.player_id === 'living' ? { ...p, synced_to: 'kitchen' } : p,
      ),
    )
    const { result } = renderHook(() => useGroupMutations(), {
      wrapper: createWrapper(queryClient),
    })

    let mutation!: Promise<unknown>
    act(() => {
      mutation = result.current.removeFromGroup('living', 'kitchen')!
    })

    // Synchronously after the tap — before the POST has resolved — both halves
    // must already say "not joined".
    const cached = queryClient.getQueryData<TestPlayer[]>(RAW_PLAYERS_KEY)
    expect(cached?.find((p) => p.player_id === 'kitchen')?.group_members).not.toContain('living')
    expect(cached?.find((p) => p.player_id === 'living')?.synced_to).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONFIRM_POLL_INTERVAL_MS)
      await mutation
    })
  })

  it("restores the follower's synced_to when a removal's POST rejects", async () => {
    post.mockRejectedValue(new Error('boom'))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(
      RAW_PLAYERS_KEY,
      kitchenGroupedWith('living').map((p) =>
        p.player_id === 'living' ? { ...p, synced_to: 'kitchen' } : p,
      ),
    )
    const { result } = renderHook(() => useGroupMutations(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await expect(result.current.removeFromGroup('living', 'kitchen')).rejects.toThrow('boom')
    })

    const cached = queryClient.getQueryData<TestPlayer[]>(RAW_PLAYERS_KEY)
    expect(cached?.find((p) => p.player_id === 'kitchen')?.group_members).toContain('living')
    expect(cached?.find((p) => p.player_id === 'living')?.synced_to).toBe('kitchen')
  })

  it('setGroupVolume never confirmation-polls, so a drag cannot fan out into hundreds of reads', async () => {
    // The group-volume control is an `<input type="range">` whose onChange
    // fires on every drag step. Confirming each intermediate level against
    // `/players` would poll every 500ms for the full 6s bound per step — the
    // levels are superseded before they can ever match — so one drag would
    // issue hundreds of reads with polling paused throughout.
    post.mockResolvedValue({})
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(RAW_PLAYERS_KEY, rawPlayers())
    const { result } = renderHook(() => useGroupMutations(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await Promise.all(
        [20, 25, 30, 35, 40].map((level) => result.current.setGroupVolume('kitchen', level)),
      )
      await vi.advanceTimersByTimeAsync(CONFIRM_POLL_TIMEOUT_MS * 2)
    })

    expect(post).toHaveBeenCalledTimes(5)
    expect(get).not.toHaveBeenCalled()
    expect(result.current.pollingPaused).toBe(false)
  })

  it('setGroupVolume rolls back to the previous volume when the POST rejects', async () => {
    post.mockRejectedValue(new Error('boom'))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(
      RAW_PLAYERS_KEY,
      rawPlayers().map((p) => (p.player_id === 'kitchen' ? { ...p, group_volume: 50 } : p)),
    )
    const { result } = renderHook(() => useGroupMutations(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await expect(result.current.setGroupVolume('kitchen', 30)).rejects.toThrow('boom')
    })

    expect(
      queryClient
        .getQueryData<TestPlayer[]>(RAW_PLAYERS_KEY)
        ?.find((p) => p.player_id === 'kitchen')?.group_volume,
    ).toBe(50)
  })

  it('setGroupVolume is a no-op when there is no leader', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useGroupMutations(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.setGroupVolume(null, 30)
    })

    expect(post).not.toHaveBeenCalled()
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Lifted verbatim from grid's PlayerPicker (see useGroupMutations.ts's own
// header comment) — these tests exercise the optimistic cache patching,
// pending-id bookkeeping, and cancel/resume polling sequencing entirely
// against a mocked `musicIntegration.api.post`. No real Sonos endpoint is
// ever called — see the room-grouping brief on why that's a hard
// constraint, not just a test-speed choice.
const post = vi.hoisted(() => vi.fn())
vi.mock('./config', () => ({ musicIntegration: { api: { post } } }))

import { useGroupMutations } from './useGroupMutations'

const RAW_PLAYERS_KEY = ['music', 'players']

function rawPlayers() {
  return [
    { player_id: 'kitchen', display_name: 'Kitchen', group_members: [], can_group_with: ['living'] },
    { player_id: 'living', display_name: 'Living Room', group_members: [], can_group_with: ['kitchen'] },
  ]
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useGroupMutations', () => {
  afterEach(() => {
    post.mockReset()
  })

  it('addToGroup posts /group and optimistically adds the leader + follower to group_members', async () => {
    post.mockResolvedValue({})
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(RAW_PLAYERS_KEY, rawPlayers())
    const { result } = renderHook(() => useGroupMutations(), { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await result.current.addToGroup('living', 'kitchen')
    })

    expect(post).toHaveBeenCalledWith('/group', { player_id: 'living', target_player: 'kitchen' })
    const cached = queryClient.getQueryData<{ player_id: string; group_members: string[] }[]>(RAW_PLAYERS_KEY)!
    expect(cached.find((p) => p.player_id === 'kitchen')!.group_members).toEqual(['kitchen', 'living'])
    expect(result.current.pendingIds.has('living')).toBe(false)
  })

  it('addToGroup is a no-op when there is no leader', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useGroupMutations(), { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await result.current.addToGroup('living', null)
    })

    expect(post).not.toHaveBeenCalled()
  })

  it('removeFromGroup posts /ungroup and collapses group_members to [] once only the leader remains', async () => {
    post.mockResolvedValue({})
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(RAW_PLAYERS_KEY, [
      { player_id: 'kitchen', display_name: 'Kitchen', group_members: ['kitchen', 'living'], can_group_with: ['living'] },
      { player_id: 'living', display_name: 'Living Room', group_members: [], can_group_with: ['kitchen'] },
    ])
    const { result } = renderHook(() => useGroupMutations(), { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await result.current.removeFromGroup('living', 'kitchen')
    })

    expect(post).toHaveBeenCalledWith('/ungroup', { player_id: 'living' })
    const cached = queryClient.getQueryData<{ player_id: string; group_members: string[] }[]>(RAW_PLAYERS_KEY)!
    expect(cached.find((p) => p.player_id === 'kitchen')!.group_members).toEqual([])
  })

  it('marks a player pending during the request and clears it once the optimistic patch lands', async () => {
    let resolvePost: () => void = () => {}
    post.mockReturnValue(new Promise<void>((resolve) => { resolvePost = resolve }))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(RAW_PLAYERS_KEY, rawPlayers())
    const { result } = renderHook(() => useGroupMutations(), { wrapper: createWrapper(queryClient) })

    let mutation!: Promise<unknown>
    act(() => {
      mutation = result.current.addToGroup('living', 'kitchen')!
    })
    await waitFor(() => expect(result.current.pendingIds.has('living')).toBe(true))
    expect(result.current.pollingPaused).toBe(true)

    await act(async () => {
      resolvePost()
      await mutation
    })
    expect(result.current.pendingIds.has('living')).toBe(false)
  })

  it('clears the pending id when the POST rejects, without applying the optimistic patch', async () => {
    post.mockRejectedValue(new Error('boom'))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(RAW_PLAYERS_KEY, rawPlayers())
    const { result } = renderHook(() => useGroupMutations(), { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await expect(result.current.addToGroup('living', 'kitchen')).rejects.toThrow('boom')
    })

    expect(result.current.pendingIds.has('living')).toBe(false)
    const cached = queryClient.getQueryData<{ player_id: string; group_members: string[] }[]>(RAW_PLAYERS_KEY)!
    expect(cached.find((p) => p.player_id === 'kitchen')!.group_members).toEqual([])
  })

  it('ungroupAll posts /ungroup for every follower and clears the leader’s group_members', async () => {
    post.mockResolvedValue({})
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(RAW_PLAYERS_KEY, [
      { player_id: 'kitchen', display_name: 'Kitchen', group_members: ['kitchen', 'living', 'bedroom'], can_group_with: [] },
      { player_id: 'living', display_name: 'Living Room', group_members: [], can_group_with: [] },
      { player_id: 'bedroom', display_name: 'Bedroom', group_members: [], can_group_with: [] },
    ])
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
    const { result } = renderHook(() => useGroupMutations(), { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await result.current.ungroupAll(leader)
    })

    expect(post).toHaveBeenCalledWith('/ungroup', { player_id: 'living' })
    expect(post).toHaveBeenCalledWith('/ungroup', { player_id: 'bedroom' })
    const cached = queryClient.getQueryData<{ player_id: string; group_members: string[] }[]>(RAW_PLAYERS_KEY)!
    expect(cached.find((p) => p.player_id === 'kitchen')!.group_members).toEqual([])
  })

  it('ungroupAll is a no-op when there is no leader', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useGroupMutations(), { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await result.current.ungroupAll(null)
    })

    expect(post).not.toHaveBeenCalled()
  })

  it('setGroupVolume posts /group-volume and invalidates the players query, without optimistic patching', async () => {
    post.mockResolvedValue({})
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useGroupMutations(), { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await result.current.setGroupVolume('kitchen', 30)
    })

    expect(post).toHaveBeenCalledWith('/group-volume', { player_id: 'kitchen', level: 30 })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: RAW_PLAYERS_KEY })
  })

  it('setGroupVolume is a no-op when there is no leader', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useGroupMutations(), { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await result.current.setGroupVolume(null, 30)
    })

    expect(post).not.toHaveBeenCalled()
  })
})

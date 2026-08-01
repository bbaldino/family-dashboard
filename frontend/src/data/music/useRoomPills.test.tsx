import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ─── the hook's dependencies, mocked so the wiring tests below control
// config/players/mutations directly instead of going through a real query
// client or config fetch — vi.mock calls are hoisted above every import in
// this file (same convention `scenario-wiring.test.tsx` uses), so
// `useRoomPills` itself resolves against these mocks once imported below.
const useIntegrationConfig = vi.hoisted(() => vi.fn())
vi.mock('@/data/use-integration-config', () => ({ useIntegrationConfig }))

const usePlayers = vi.hoisted(() => vi.fn())
vi.mock('./usePlayers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./usePlayers')>()),
  usePlayers,
}))

const addToGroup = vi.hoisted(() => vi.fn())
const removeFromGroup = vi.hoisted(() => vi.fn())
const useGroupMutations = vi.hoisted(() => vi.fn())
vi.mock('./useGroupMutations', () => ({ useGroupMutations }))

import { musicPlayersFixtureFor } from './fixtures'
import { normalizePlayer } from './usePlayers'
import type { Player } from './types'
import { resolveAnchorAndRooms, isJoinedToAnchor, useRoomPills } from './useRoomPills'

// ─── pure resolution logic, exercised directly against the fixtures ───────
//
// These cover the room-grouping brief's four required fixture roles —
// anchor, joinable room, already-joined room, room that can't group — using
// the same `packed` players payload the app itself would fetch under
// `?scenario=packed`. No component, no query client, no config fetch: just
// the resolution logic the hook below wires up.

function fixturePlayers(): Player[] {
  return musicPlayersFixtureFor('packed')!.map(normalizePlayer)
}

describe('resolveAnchorAndRooms', () => {
  it('returns no anchor and no rooms when no anchor id is configured', () => {
    expect(resolveAnchorAndRooms(fixturePlayers(), null)).toEqual({ anchor: null, rooms: [] })
    expect(resolveAnchorAndRooms(fixturePlayers(), undefined)).toEqual({ anchor: null, rooms: [] })
  })

  it('returns no anchor and no rooms when the configured id is not in the players list', () => {
    expect(resolveAnchorAndRooms(fixturePlayers(), 'RINCON_NOT_IN_LIST')).toEqual({ anchor: null, rooms: [] })
  })

  it('returns no anchor and no rooms against an empty players list (cold cache)', () => {
    expect(resolveAnchorAndRooms([], 'fixture-kitchen')).toEqual({ anchor: null, rooms: [] })
  })

  it('resolves the anchor and filters rooms to only those it can group with', () => {
    const players = fixturePlayers()
    const { anchor, rooms } = resolveAnchorAndRooms(players, 'fixture-kitchen')
    expect(anchor?.displayName).toBe('Kitchen')
    // Only Living Room and Bedroom are in the anchor's can_group_with — the
    // Office Display (can't group at all) is excluded.
    expect(rooms.map((r) => r.displayName).sort()).toEqual(['Bedroom', 'Living Room'])
  })

  it('never includes the anchor itself among the rooms', () => {
    const { anchor, rooms } = resolveAnchorAndRooms(fixturePlayers(), 'fixture-kitchen')
    expect(rooms.some((r) => r.playerId === anchor?.playerId)).toBe(false)
  })
})

describe('isJoinedToAnchor', () => {
  const players = fixturePlayers()
  const anchor = players.find((p) => p.displayName === 'Kitchen')!

  it('reads the already-joined room (Bedroom) as joined', () => {
    const bedroom = players.find((p) => p.displayName === 'Bedroom')!
    expect(isJoinedToAnchor(anchor, bedroom)).toBe(true)
  })

  it('reads the joinable-but-not-joined room (Living Room) as not joined', () => {
    const livingRoom = players.find((p) => p.displayName === 'Living Room')!
    expect(isJoinedToAnchor(anchor, livingRoom)).toBe(false)
  })
})

// ─── the hook itself: config → players → mutations wiring ─────────────────

describe('useRoomPills', () => {
  beforeEach(() => {
    addToGroup.mockClear()
    removeFromGroup.mockClear()
    useGroupMutations.mockReturnValue({
      pendingIds: new Set<string>(),
      pollingPaused: false,
      addToGroup,
      removeFromGroup,
    })
  })

  it('renders no pills when no anchor is configured', () => {
    useIntegrationConfig.mockReturnValue({ default_player: undefined })
    usePlayers.mockReturnValue({ data: musicPlayersFixtureFor('packed') })
    const { result } = renderHook(() => useRoomPills())
    expect(result.current.pills).toEqual([])
  })

  it('renders no pills before the players query has resolved (cold cache)', () => {
    useIntegrationConfig.mockReturnValue({ default_player: 'fixture-kitchen' })
    usePlayers.mockReturnValue({ data: undefined })
    const { result } = renderHook(() => useRoomPills())
    expect(result.current.pills).toEqual([])
  })

  it('renders no pills when the configured anchor is not in the players list', () => {
    useIntegrationConfig.mockReturnValue({ default_player: 'RINCON_NOT_IN_LIST' })
    usePlayers.mockReturnValue({ data: musicPlayersFixtureFor('packed') })
    const { result } = renderHook(() => useRoomPills())
    expect(result.current.pills).toEqual([])
  })

  it('puts the anchor first, always joined and never pending', () => {
    useIntegrationConfig.mockReturnValue({ default_player: 'fixture-kitchen' })
    usePlayers.mockReturnValue({ data: musicPlayersFixtureFor('packed') })
    const { result } = renderHook(() => useRoomPills())
    const [first] = result.current.pills
    expect(first.player.displayName).toBe('Kitchen')
    expect(first.isAnchor).toBe(true)
    expect(first.joined).toBe(true)
  })

  it('reflects joined/not-joined for the other rooms and excludes the ungroupable one', () => {
    useIntegrationConfig.mockReturnValue({ default_player: 'fixture-kitchen' })
    usePlayers.mockReturnValue({ data: musicPlayersFixtureFor('packed') })
    const { result } = renderHook(() => useRoomPills())
    const byName = Object.fromEntries(result.current.pills.map((p) => [p.player.displayName, p]))
    expect(byName['Bedroom'].joined).toBe(true)
    expect(byName['Living Room'].joined).toBe(false)
    expect(byName['Office Display']).toBeUndefined()
  })

  it('toggle calls addToGroup for a not-yet-joined room', () => {
    useIntegrationConfig.mockReturnValue({ default_player: 'fixture-kitchen' })
    usePlayers.mockReturnValue({ data: musicPlayersFixtureFor('packed') })
    const { result } = renderHook(() => useRoomPills())
    act(() => result.current.toggle('fixture-living-room'))
    expect(addToGroup).toHaveBeenCalledWith('fixture-living-room', 'fixture-kitchen')
    expect(removeFromGroup).not.toHaveBeenCalled()
  })

  it('toggle calls removeFromGroup for an already-joined room', () => {
    useIntegrationConfig.mockReturnValue({ default_player: 'fixture-kitchen' })
    usePlayers.mockReturnValue({ data: musicPlayersFixtureFor('packed') })
    const { result } = renderHook(() => useRoomPills())
    act(() => result.current.toggle('fixture-bedroom'))
    expect(removeFromGroup).toHaveBeenCalledWith('fixture-bedroom', 'fixture-kitchen')
    expect(addToGroup).not.toHaveBeenCalled()
  })

  it('toggle is a no-op for the anchor’s own id', () => {
    useIntegrationConfig.mockReturnValue({ default_player: 'fixture-kitchen' })
    usePlayers.mockReturnValue({ data: musicPlayersFixtureFor('packed') })
    const { result } = renderHook(() => useRoomPills())
    act(() => result.current.toggle('fixture-kitchen'))
    expect(addToGroup).not.toHaveBeenCalled()
    expect(removeFromGroup).not.toHaveBeenCalled()
  })

  it('toggle is a no-op for a room mid-mutation', () => {
    useIntegrationConfig.mockReturnValue({ default_player: 'fixture-kitchen' })
    usePlayers.mockReturnValue({ data: musicPlayersFixtureFor('packed') })
    useGroupMutations.mockReturnValue({
      pendingIds: new Set(['fixture-living-room']),
      pollingPaused: true,
      addToGroup,
      removeFromGroup,
    })
    const { result } = renderHook(() => useRoomPills())
    expect(result.current.pills.find((p) => p.player.playerId === 'fixture-living-room')?.pending).toBe(true)
    act(() => result.current.toggle('fixture-living-room'))
    expect(addToGroup).not.toHaveBeenCalled()
  })
})

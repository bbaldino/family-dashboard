import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlayerPicker } from './PlayerPicker'

// This file verifies PlayerPicker still *renders* correctly after its
// group/ungroup/group-volume mutations were lifted into
// `@/data/music/useGroupMutations` (see the room-grouping brief). It
// deliberately never taps an Add/Remove/Ungroup button or calls a mutation
// function — these are real Sonos units in someone's house, and the brief
// is explicit that PlayerPicker's mutations stay unexercised here the same
// way broadsheet's do (see `useRoomPills.test.tsx`). `useGroupMutations`
// itself already has its own optimistic-update test coverage in
// `useGroupMutations.test.tsx`, entirely against a mocked API.
const useMusic = vi.hoisted(() => vi.fn())
const usePlayers = vi.hoisted(() => vi.fn())
const useGroupMutations = vi.hoisted(() => vi.fn())
const normalizePlayer = vi.hoisted(() =>
  vi.fn((raw) => ({
    playerId: raw.player_id,
    displayName: raw.display_name,
    state: raw.state ?? 'idle',
    available: raw.available ?? true,
    volumeLevel: raw.volume_level ?? null,
    groupMembers: raw.group_members ?? [],
    syncedTo: raw.synced_to ?? null,
    canGroupWith: raw.can_group_with ?? [],
    groupVolume: raw.group_volume ?? null,
  })),
)
vi.mock('@/data/music', () => ({ useMusic, usePlayers, normalizePlayer, useGroupMutations }))

const rawPlayers = [
  { player_id: 'kitchen', display_name: 'Kitchen', state: 'playing', volume_level: 45, group_members: ['kitchen', 'bedroom'], can_group_with: ['living', 'bedroom'], group_volume: 38 },
  { player_id: 'bedroom', display_name: 'Bedroom', state: 'playing', volume_level: 30 },
  { player_id: 'living', display_name: 'Living Room', state: 'idle', volume_level: 20 },
  { player_id: 'office-display', display_name: 'Office Display', state: 'idle', volume_level: 50 },
]

function noopMutations() {
  return {
    pendingIds: new Set<string>(),
    pollingPaused: false,
    addToGroup: vi.fn(),
    removeFromGroup: vi.fn(),
    ungroupAll: vi.fn(),
    setGroupVolume: vi.fn(),
  }
}

describe('PlayerPicker (post-lift render)', () => {
  beforeEach(() => {
    useMusic.mockReturnValue({ state: { activeQueue: { queueId: 'kitchen' } }, setVolume: vi.fn() })
    useGroupMutations.mockReturnValue(noopMutations())
  })

  it('shows a loading spinner while players are loading', () => {
    usePlayers.mockReturnValue({ data: undefined, isLoading: true })
    render(<PlayerPicker isOpen onClose={vi.fn()} />)
    expect(screen.getByText('Players')).toBeInTheDocument()
  })

  it('shows the empty state when there are no players', () => {
    usePlayers.mockReturnValue({ data: [], isLoading: false })
    render(<PlayerPicker isOpen onClose={vi.fn()} />)
    expect(screen.getByText('No players available')).toBeInTheDocument()
  })

  it('renders the leader, its follower, a joinable room, and an incompatible one', () => {
    usePlayers.mockReturnValue({ data: rawPlayers, isLoading: false })
    render(<PlayerPicker isOpen onClose={vi.fn()} />)

    expect(screen.getByText('Kitchen')).toBeInTheDocument()
    expect(screen.getByText('Leader')).toBeInTheDocument()
    expect(screen.getByText('Bedroom')).toBeInTheDocument()
    expect(screen.getByText('Living Room')).toBeInTheDocument()
    expect(screen.getByText('Office Display')).toBeInTheDocument()
    expect(screen.getByText('incompatible')).toBeInTheDocument()
  })

  it('renders the group-volume panel and an Ungroup all button when the leader has a follower', () => {
    usePlayers.mockReturnValue({ data: rawPlayers, isLoading: false })
    render(<PlayerPicker isOpen onClose={vi.fn()} />)

    expect(screen.getByText('Group volume')).toBeInTheDocument()
    expect(screen.getByText('2 speakers')).toBeInTheDocument()
    expect(screen.getByText('Ungroup all')).toBeInTheDocument()
    expect(screen.getByText('Remove')).toBeInTheDocument()
  })

  it('renders an Add button for a room that can join but has not', () => {
    usePlayers.mockReturnValue({ data: rawPlayers, isLoading: false })
    render(<PlayerPicker isOpen onClose={vi.fn()} />)
    expect(screen.getByText('Add')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    usePlayers.mockReturnValue({ data: rawPlayers, isLoading: false })
    render(<PlayerPicker isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByText('Players')).not.toBeInTheDocument()
  })
})

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MediaMasthead } from './MediaMasthead'

const useMusic = vi.hoisted(() => vi.fn())
const usePlayers = vi.hoisted(() => vi.fn())
const normalizePlayer = vi.hoisted(() =>
  vi.fn((raw) => ({
    playerId: raw.player_id,
    displayName: raw.display_name,
    state: raw.state ?? 'idle',
    available: true,
    volumeLevel: raw.volume_level ?? null,
    groupMembers: [],
    syncedTo: null,
    canGroupWith: [],
    groupVolume: null,
  })),
)
vi.mock('@/data/music', () => ({ useMusic, usePlayers, normalizePlayer }))

describe('MediaMasthead', () => {
  beforeEach(() => {
    usePlayers.mockReturnValue({ data: [] })
  })

  it('shows a written fallback when nothing is playing anywhere', () => {
    useMusic.mockReturnValue({ state: { queues: [], activeQueue: null } })
    render(<MediaMasthead />)
    expect(screen.getByText('Quiet')).toBeInTheDocument()
    expect(screen.getByText('Now playing')).toBeInTheDocument()
  })

  it('shows the active queue’s room as the centrepiece', () => {
    useMusic.mockReturnValue({
      state: { queues: [], activeQueue: { queueId: 'kitchen', displayName: 'Kitchen', state: 'playing', currentItem: null, volumeLevel: 50 } },
    })
    render(<MediaMasthead />)
    expect(screen.getByText('the Kitchen')).toBeInTheDocument()
    expect(screen.getByText('Now playing in')).toBeInTheDocument()
  })

  it('renders a room pill per player and highlights the active one', () => {
    useMusic.mockReturnValue({
      state: { queues: [], activeQueue: { queueId: 'kitchen', displayName: 'Kitchen', state: 'playing', currentItem: null, volumeLevel: 50 } },
    })
    usePlayers.mockReturnValue({
      data: [
        { player_id: 'kitchen', display_name: 'Kitchen', state: 'playing' },
        { player_id: 'living', display_name: 'Living Room', state: 'idle' },
      ],
    })
    render(<MediaMasthead />)
    const active = screen.getByText('Kitchen')
    const inactive = screen.getByText('Living Room')
    expect(active.style.background).toBe('var(--ink)')
    expect(inactive.style.background).toBe('')
  })

  it('shows a dash when the players list is empty', () => {
    useMusic.mockReturnValue({ state: { queues: [], activeQueue: null } })
    render(<MediaMasthead />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

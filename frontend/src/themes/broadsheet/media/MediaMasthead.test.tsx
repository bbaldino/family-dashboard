import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MediaMasthead } from './MediaMasthead'

const useMusic = vi.hoisted(() => vi.fn())
const useRoomPills = vi.hoisted(() => vi.fn())
vi.mock('@/data/music', () => ({ useMusic, useRoomPills }))

const kitchen = {
  playerId: 'kitchen',
  displayName: 'Kitchen',
  state: 'playing',
  available: true,
  volumeLevel: 45,
  groupMembers: ['kitchen'],
  syncedTo: null,
  canGroupWith: ['living'],
  groupVolume: null,
}
const living = {
  playerId: 'living',
  displayName: 'Living Room',
  state: 'idle',
  available: true,
  volumeLevel: 20,
  groupMembers: [],
  syncedTo: null,
  canGroupWith: ['kitchen'],
  groupVolume: null,
}

describe('MediaMasthead', () => {
  const toggle = vi.fn()

  beforeEach(() => {
    toggle.mockClear()
    useRoomPills.mockReturnValue({ pills: [], toggle })
  })

  it('shows a written fallback when nothing is playing anywhere', () => {
    useMusic.mockReturnValue({ state: { queues: [], activeQueue: null } })
    render(<MediaMasthead />)
    expect(screen.getByText('Quiet')).toBeInTheDocument()
    expect(screen.getByText('Now playing')).toBeInTheDocument()
  })

  it('shows the active queue’s room as the centrepiece', () => {
    useMusic.mockReturnValue({
      state: {
        queues: [],
        activeQueue: {
          queueId: 'kitchen',
          displayName: 'Kitchen',
          state: 'playing',
          currentItem: null,
          volumeLevel: 50,
        },
      },
    })
    render(<MediaMasthead />)
    expect(screen.getByText('the Kitchen')).toBeInTheDocument()
    expect(screen.getByText('Now playing in')).toBeInTheDocument()
  })

  it('renders the anchor pill active and not tappable, and a joinable room outlined and tappable', () => {
    useMusic.mockReturnValue({ state: { queues: [], activeQueue: null } })
    useRoomPills.mockReturnValue({
      pills: [
        { player: kitchen, isAnchor: true, joined: true, pending: false },
        { player: living, isAnchor: false, joined: false, pending: false },
      ],
      toggle,
    })
    render(<MediaMasthead />)

    const anchorPill = screen.getByText('Kitchen')
    expect(anchorPill.style.background).toBe('var(--ink)')
    expect(anchorPill.tagName).toBe('SPAN')

    const roomPill = screen.getByRole('button', { name: 'Living Room' })
    expect(roomPill.style.background).toBe('')
    fireEvent.click(roomPill)
    expect(toggle).toHaveBeenCalledWith('living')
  })

  it('shows the joined room filled and toggling it calls toggle with its id', () => {
    useMusic.mockReturnValue({ state: { queues: [], activeQueue: null } })
    const bedroom = { ...living, playerId: 'bedroom', displayName: 'Bedroom' }
    useRoomPills.mockReturnValue({
      pills: [
        { player: kitchen, isAnchor: true, joined: true, pending: false },
        { player: bedroom, isAnchor: false, joined: true, pending: false },
      ],
      toggle,
    })
    render(<MediaMasthead />)
    const joinedPill = screen.getByRole('button', { name: 'Bedroom' })
    expect(joinedPill.style.background).toBe('var(--ink)')
    fireEvent.click(joinedPill)
    expect(toggle).toHaveBeenCalledWith('bedroom')
  })

  it('renders a pending room as a disabled, dimmed button — not a silently inert span', () => {
    useMusic.mockReturnValue({ state: { queues: [], activeQueue: null } })
    useRoomPills.mockReturnValue({
      pills: [
        { player: kitchen, isAnchor: true, joined: true, pending: false },
        { player: living, isAnchor: false, joined: false, pending: true },
      ],
      toggle,
    })
    render(<MediaMasthead />)
    const pendingPill = screen.getByRole('button', { name: 'Living Room' })
    expect(pendingPill).toBeDisabled()
    expect(pendingPill.style.opacity).toBe('0.55')
    fireEvent.click(pendingPill)
    expect(toggle).not.toHaveBeenCalled()
  })

  it('shows a dash when there are no pills — no anchor configured, no players yet, or the anchor is absent from the players list', () => {
    useMusic.mockReturnValue({ state: { queues: [], activeQueue: null } })
    useRoomPills.mockReturnValue({ pills: [], toggle })
    render(<MediaMasthead />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

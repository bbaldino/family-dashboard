import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RoomEar } from './RoomEar'

const useRoomPills = vi.hoisted(() => vi.fn())
vi.mock('@/integrations/music', () => ({ useRoomPills }))

const player = (over: Record<string, unknown> = {}) => ({
  playerId: 'kitchen',
  displayName: 'Kitchen',
  state: 'playing',
  available: true,
  volumeLevel: 45,
  groupMembers: ['kitchen'],
  syncedTo: null,
  canGroupWith: ['living'],
  groupVolume: null,
  ...over,
})

const anchorPill = { player: player(), isAnchor: true, joined: true, pending: false }
const joinable = {
  player: player({ playerId: 'living', displayName: 'Living Room', state: 'idle' }),
  isAnchor: false,
  joined: false,
  pending: false,
}

// The room ear is shared by the Centre Spread (and used to be in Media's
// masthead too). It is a control, not a readout: directing audio to a room is
// the point, so its behaviour is tested here, on the component itself, rather
// than through whichever masthead happens to host it.
describe('RoomEar', () => {
  const toggle = vi.fn()

  beforeEach(() => {
    toggle.mockClear()
    useRoomPills.mockReturnValue({ pills: [], toggle })
  })

  it('lists every room with what it is doing', () => {
    useRoomPills.mockReturnValue({ pills: [anchorPill, joinable], toggle })
    render(<RoomEar />)
    expect(screen.getByText('Kitchen')).toBeInTheDocument()
    expect(screen.getByText('playing')).toBeInTheDocument()
    expect(screen.getByText('Living Room')).toBeInTheDocument()
    expect(screen.getByText('silent')).toBeInTheDocument()
  })

  it('leaves the anchor listed but not tappable', () => {
    useRoomPills.mockReturnValue({ pills: [anchorPill], toggle })
    render(<RoomEar />)
    expect(screen.getByText('Kitchen')).toBeInTheDocument()
    // The anchor is this panel's own room: there is nothing to join it to.
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('toggles a joinable room by its player id', () => {
    useRoomPills.mockReturnValue({ pills: [anchorPill, joinable], toggle })
    render(<RoomEar />)
    fireEvent.click(screen.getByRole('button'))
    expect(toggle).toHaveBeenCalledWith('living')
  })

  it('marks a joined room as pressed so the picker reads as a control', () => {
    useRoomPills.mockReturnValue({
      pills: [anchorPill, { ...joinable, joined: true }],
      toggle,
    })
    render(<RoomEar />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('caps the list rather than growing the cell past its siblings', () => {
    // The masthead cells share one bottom-aligned baseline, so an unbounded
    // room list would pull it out of true.
    const many = Array.from({ length: 9 }, (_, i) => ({
      ...joinable,
      player: player({ playerId: `room-${i}`, displayName: `Room ${i}`, state: 'idle' }),
    }))
    useRoomPills.mockReturnValue({ pills: [anchorPill, ...many], toggle })
    render(<RoomEar />)
    expect(screen.getByText('Room 0')).toBeInTheDocument()
    expect(screen.queryByText('Room 8')).not.toBeInTheDocument()
  })

  it('says so when there are no rooms at all', () => {
    // No configured anchor, no players yet, or an anchor missing from the
    // players list — `useRoomPills` collapses all three to an empty list.
    render(<RoomEar />)
    expect(screen.getByText('No rooms')).toBeInTheDocument()
  })
})

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MediaMasthead } from './MediaMasthead'

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

describe('MediaMasthead', () => {
  const toggle = vi.fn()

  beforeEach(() => {
    toggle.mockClear()
    useRoomPills.mockReturnValue({ pills: [], toggle })
  })

  /**
   * The suite's masthead rule: the centre names or states the page, and no ear
   * is a second name. This masthead previously carried "Section IV / The
   * Listening Room" in the left ear and the anchored room in the centre ("Now
   * playing in / the Kitchen and Deck"). The left ear now lists every room —
   * strictly more than the centre said — so the centre names the page.
   *
   * The absences are asserted alongside the presence: naming the page would
   * pass on its own with the retired labels still beside it.
   */
  it('names the page in the centre, with no page-name ear', () => {
    useRoomPills.mockReturnValue({ pills: [anchorPill], toggle })
    render(<MediaMasthead />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Media')
    expect(screen.queryByText('The Listening Room')).not.toBeInTheDocument()
    expect(screen.queryByText(/Section IV/)).not.toBeInTheDocument()
  })

  it('lists every room with what it is doing', () => {
    useRoomPills.mockReturnValue({ pills: [anchorPill, joinable], toggle })
    render(<MediaMasthead />)
    expect(screen.getByText('Kitchen')).toBeInTheDocument()
    expect(screen.getByText('playing')).toBeInTheDocument()
    expect(screen.getByText('Living Room')).toBeInTheDocument()
    expect(screen.getByText('silent')).toBeInTheDocument()
  })

  it('leaves the anchor listed but not tappable', () => {
    useRoomPills.mockReturnValue({ pills: [anchorPill], toggle })
    render(<MediaMasthead />)
    expect(screen.getByText('Kitchen')).toBeInTheDocument()
    // The anchor is this panel's own room: there is nothing to join it to.
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('toggles a joinable room by its player id', () => {
    useRoomPills.mockReturnValue({ pills: [anchorPill, joinable], toggle })
    render(<MediaMasthead />)
    fireEvent.click(screen.getByRole('button'))
    expect(toggle).toHaveBeenCalledWith('living')
  })

  it('marks a joined room as pressed so the picker reads as a control', () => {
    useRoomPills.mockReturnValue({
      pills: [anchorPill, { ...joinable, joined: true }],
      toggle,
    })
    render(<MediaMasthead />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('caps the list rather than growing the cell past its siblings', () => {
    // The three masthead cells share one bottom-aligned baseline, so an
    // unbounded room list would pull it out of true.
    const many = Array.from({ length: 9 }, (_, i) => ({
      ...joinable,
      player: player({ playerId: `room-${i}`, displayName: `Room ${i}`, state: 'idle' }),
    }))
    useRoomPills.mockReturnValue({ pills: [anchorPill, ...many], toggle })
    render(<MediaMasthead />)
    expect(screen.getByText('Room 0')).toBeInTheDocument()
    expect(screen.queryByText('Room 8')).not.toBeInTheDocument()
  })

  it('says so when there are no rooms at all', () => {
    // No configured anchor, no players yet, or an anchor missing from the
    // players list — `useRoomPills` collapses all three to an empty list.
    render(<MediaMasthead />)
    expect(screen.getByText('No rooms')).toBeInTheDocument()
  })

  it('renders the right ear empty rather than inventing library counts', () => {
    // The design puts tracks/albums/playlists totals here; no music route
    // reports them. See the component's own comment.
    useRoomPills.mockReturnValue({ pills: [anchorPill], toggle })
    render(<MediaMasthead />)
    expect(screen.queryByText(/tracks|albums|playlists/i)).not.toBeInTheDocument()
  })
})

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CentreSpreadCredits } from './CentreSpreadCredits'

const useRoomPills = vi.hoisted(() => vi.fn())
vi.mock('@/data/music', () => ({ useRoomPills }))

const kitchen = { playerId: 'kitchen', displayName: 'Kitchen', state: 'playing', available: true, volumeLevel: 45, groupMembers: ['kitchen'], syncedTo: null, canGroupWith: ['living'], groupVolume: null }
const living = { playerId: 'living', displayName: 'Living Room', state: 'idle', available: true, volumeLevel: 20, groupMembers: [], syncedTo: null, canGroupWith: ['kitchen'], groupVolume: null }

const activeQueue = {
  queueId: 'kitchen',
  displayName: 'Kitchen',
  state: 'playing' as const,
  currentItem: null,
  volumeLevel: 45,
}

const fullTrack = {
  name: 'Amber Hours',
  artist: 'The Night Shift',
  album: 'Late Bloom',
  imageUrl: null,
  duration: 238,
  elapsed: 71,
  uri: 'u1',
  year: 2023,
  label: 'Harbor Sound Records',
  trackNumber: 1,
  source: 'spotify--yC8brUbw',
}

describe('CentreSpreadCredits', () => {
  const onSetVolume = vi.fn()
  const toggle = vi.fn()

  beforeEach(() => {
    onSetVolume.mockClear()
    toggle.mockClear()
    useRoomPills.mockReturnValue({ pills: [], toggle })
  })

  it('renders exactly four credit rows — Artist, Album, Released, Source — never a fifth Label row', () => {
    render(<CentreSpreadCredits track={fullTrack} activeQueue={activeQueue} onSetVolume={onSetVolume} />)
    expect(screen.getByText('Artist')).toBeInTheDocument()
    expect(screen.getByText('Album')).toBeInTheDocument()
    expect(screen.getByText('Released')).toBeInTheDocument()
    expect(screen.getByText('Source')).toBeInTheDocument()
    expect(screen.queryByText('Label')).not.toBeInTheDocument()
    expect(screen.queryByText('Harbor Sound Records')).not.toBeInTheDocument()
  })

  it('shows the values, formatting the raw provider id as a human source label', () => {
    render(<CentreSpreadCredits track={fullTrack} activeQueue={activeQueue} onSetVolume={onSetVolume} />)
    expect(screen.getByText('The Night Shift')).toBeInTheDocument()
    expect(screen.getByText('Late Bloom')).toBeInTheDocument()
    expect(screen.getByText('2023')).toBeInTheDocument()
    expect(screen.getByText('Spotify')).toBeInTheDocument()
  })

  it('falls back to a dash for missing album/year/source without dropping the row', () => {
    const sparseTrack = { ...fullTrack, album: null, year: null, source: null }
    // A non-empty pill list, so the only dashes are the three credit-row
    // fallbacks — not also the empty-pills "Playing in" fallback this
    // file's other tests exercise separately.
    useRoomPills.mockReturnValue({ pills: [{ player: kitchen, isAnchor: true, joined: true, pending: false }], toggle })
    render(<CentreSpreadCredits track={sparseTrack} activeQueue={activeQueue} onSetVolume={onSetVolume} />)
    const dashes = screen.getAllByText('—')
    // Album, Released, Source all fall back — three dashes among the four rows.
    expect(dashes.length).toBe(3)
  })

  it('renders the anchor pill active and not tappable, and a joinable room outlined and tappable', () => {
    useRoomPills.mockReturnValue({
      pills: [
        { player: kitchen, isAnchor: true, joined: true, pending: false },
        { player: living, isAnchor: false, joined: false, pending: false },
      ],
      toggle,
    })
    render(<CentreSpreadCredits track={fullTrack} activeQueue={activeQueue} onSetVolume={onSetVolume} />)

    const anchorPill = screen.getByText('Kitchen')
    expect(anchorPill.style.background).toBe('var(--ink)')
    expect(anchorPill.tagName).toBe('SPAN')

    const roomPill = screen.getByRole('button', { name: 'Living Room' })
    expect(roomPill.style.background).toBe('')
    fireEvent.click(roomPill)
    expect(toggle).toHaveBeenCalledWith('living')
  })

  it('renders a pending room as a disabled, dimmed button — consistent with the masthead', () => {
    useRoomPills.mockReturnValue({
      pills: [
        { player: kitchen, isAnchor: true, joined: true, pending: false },
        { player: living, isAnchor: false, joined: false, pending: true },
      ],
      toggle,
    })
    render(<CentreSpreadCredits track={fullTrack} activeQueue={activeQueue} onSetVolume={onSetVolume} />)
    const pendingPill = screen.getByRole('button', { name: 'Living Room' })
    expect(pendingPill).toBeDisabled()
    expect(pendingPill.style.opacity).toBe('0.55')
    fireEvent.click(pendingPill)
    expect(toggle).not.toHaveBeenCalled()
  })

  it('shows a dash when there are no pills — no anchor configured, no players yet, or the anchor is absent from the players list', () => {
    render(<CentreSpreadCredits track={fullTrack} activeQueue={activeQueue} onSetVolume={onSetVolume} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('sets volume from a tap position on the volume bar', () => {
    render(<CentreSpreadCredits track={fullTrack} activeQueue={activeQueue} onSetVolume={onSetVolume} />)
    const slider = screen.getByLabelText('Volume')
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 100, top: 0, right: 100, bottom: 0, height: 0, x: 0, y: 0, toJSON: () => {} })
    fireEvent.click(slider, { clientX: 30 })
    expect(onSetVolume).toHaveBeenCalledWith('kitchen', 30)
  })
})

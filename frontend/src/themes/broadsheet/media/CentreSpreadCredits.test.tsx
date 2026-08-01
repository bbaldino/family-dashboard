import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CentreSpreadCredits } from './CentreSpreadCredits'

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
vi.mock('@/data/music', () => ({ usePlayers, normalizePlayer }))

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

  beforeEach(() => {
    onSetVolume.mockClear()
    usePlayers.mockReturnValue({ data: [] })
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
    // A player list, so the only dashes are the three credit-row fallbacks —
    // not also the empty-players "Playing in" fallback this file's other
    // tests exercise separately.
    usePlayers.mockReturnValue({ data: [{ player_id: 'kitchen', display_name: 'Kitchen', state: 'playing' }] })
    render(<CentreSpreadCredits track={sparseTrack} activeQueue={activeQueue} onSetVolume={onSetVolume} />)
    const dashes = screen.getAllByText('—')
    // Album, Released, Source all fall back — three dashes among the four rows.
    expect(dashes.length).toBe(3)
  })

  it('renders a room pill per player and highlights the active room', () => {
    usePlayers.mockReturnValue({
      data: [
        { player_id: 'kitchen', display_name: 'Kitchen', state: 'playing' },
        { player_id: 'living', display_name: 'Living Room', state: 'idle' },
      ],
    })
    render(<CentreSpreadCredits track={fullTrack} activeQueue={activeQueue} onSetVolume={onSetVolume} />)
    const active = screen.getByText('Kitchen')
    const inactive = screen.getByText('Living Room')
    expect(active.style.background).toBe('var(--ink)')
    expect(inactive.style.background).toBe('')
  })

  it('shows a dash when there are no players', () => {
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

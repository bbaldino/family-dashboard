import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Media } from './Media'

const useMusic = vi.hoisted(() => vi.fn())
const usePlayers = vi.hoisted(() => vi.fn())
const useTopTracks = vi.hoisted(() => vi.fn())
const useRecentlyPlayed = vi.hoisted(() => vi.fn())
const useForYou = vi.hoisted(() => vi.fn())
const useSearch = vi.hoisted(() => vi.fn())
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
const getImageUrl = vi.hoisted(() => vi.fn(() => null))

vi.mock('@/data/music', () => ({
  useMusic,
  usePlayers,
  useTopTracks,
  useRecentlyPlayed,
  useForYou,
  useSearch,
  normalizePlayer,
  getImageUrl,
}))

const play = vi.fn()
const musicActions = {
  play,
  pause: vi.fn(),
  resume: vi.fn(),
  next: vi.fn(),
  previous: vi.fn(),
  setVolume: vi.fn(),
  isPlaying: false,
}

describe('broadsheet Media (The Listening Room)', () => {
  beforeEach(() => {
    useMusic.mockReturnValue({ state: { queues: [], activeQueue: null }, ...musicActions })
    usePlayers.mockReturnValue({ data: [] })
    useTopTracks.mockReturnValue({ data: [] })
    useRecentlyPlayed.mockReturnValue({ data: [] })
    useForYou.mockReturnValue({ data: [] })
    useSearch.mockReturnValue({ data: undefined, isFetching: false })
  })

  it('renders the full page with every data source empty (cold cache)', () => {
    expect(() => render(<Media />)).not.toThrow()
    expect(screen.getByTestId('broadsheet-media')).toBeInTheDocument()
  })

  it('fills the design canvas exactly', () => {
    render(<Media />)
    const root = screen.getByTestId('broadsheet-media')
    expect(root.className).toContain('w-[1600px]')
    expect(root.className).toContain('h-[900px]')
  })

  it('survives every hook returning undefined on first paint', () => {
    useMusic.mockReturnValue({ state: { queues: [], activeQueue: null }, ...musicActions })
    usePlayers.mockReturnValue({ data: undefined })
    useTopTracks.mockReturnValue({ data: undefined })
    useRecentlyPlayed.mockReturnValue({ data: undefined })
    useForYou.mockReturnValue({ data: undefined })
    expect(() => render(<Media />)).not.toThrow()
  })

  it('shows the Quick Dials tab by default', () => {
    useTopTracks.mockReturnValue({ data: [{ uri: 'u1', name: 'Amber Hours', artist: 'The Night Shift', album: null, image_url: null, play_count: 1, last_played: 0 }] })
    render(<Media />)
    expect(screen.getByText('Frequently played')).toBeInTheDocument()
  })

  it('switches to the For You tab on tap', () => {
    useForYou.mockReturnValue({ data: [{ name: 'Late Night Drive', description: 'Discover Weekly', uri: 'p1', image: null }] })
    render(<Media />)
    fireEvent.click(screen.getByText('For You'))
    expect(screen.getByText('Late Night Drive')).toBeInTheDocument()
  })

  it('shows search results instead of the active tab once the query is long enough', async () => {
    useSearch.mockReturnValue({
      data: { tracks: [{ name: 'Amber Hours', uri: 't1', media_type: 'track', artist: 'The Night Shift', image: null }], artists: [], albums: [], playlists: [] },
      isFetching: false,
    })
    render(<Media />)
    fireEvent.change(screen.getByLabelText('Search music'), { target: { value: 'amber' } })
    await waitFor(() => expect(screen.getByText('Results')).toBeInTheDocument())
    expect(screen.queryByText('Frequently played')).not.toBeInTheDocument()
  })
})

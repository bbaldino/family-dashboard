import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Media } from './Media'

function renderMedia() {
  return render(
    <MemoryRouter>
      <Media />
    </MemoryRouter>,
  )
}

const useMusic = vi.hoisted(() => vi.fn())
const useRoomPills = vi.hoisted(() => vi.fn())
const useTopTracks = vi.hoisted(() => vi.fn())
const useRecentlyPlayed = vi.hoisted(() => vi.fn())
const usePlaylists = vi.hoisted(() => vi.fn())
const useForYou = vi.hoisted(() => vi.fn())
const useSearch = vi.hoisted(() => vi.fn())
const useQueue = vi.hoisted(() => vi.fn())
const getImageUrl = vi.hoisted(() => vi.fn(() => null))

vi.mock('@/integrations/music', () => ({
  useMusic,
  useRoomPills,
  useTopTracks,
  useRecentlyPlayed,
  usePlaylists,
  useForYou,
  useSearch,
  useQueue,
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
    useRoomPills.mockReturnValue({ pills: [], toggle: vi.fn() })
    useTopTracks.mockReturnValue({ data: [] })
    useRecentlyPlayed.mockReturnValue({ data: [] })
    usePlaylists.mockReturnValue({ data: [] })
    useForYou.mockReturnValue({ data: [] })
    useSearch.mockReturnValue({ data: undefined, isFetching: false })
    useQueue.mockReturnValue({ data: [] })
  })

  it('renders the full page with every data source empty (cold cache)', () => {
    expect(() => renderMedia()).not.toThrow()
    expect(screen.getByTestId('broadsheet-media')).toBeInTheDocument()
  })

  it('fills the design canvas exactly', () => {
    renderMedia()
    const root = screen.getByTestId('broadsheet-media')
    expect(root.className).toContain('w-[1600px]')
    expect(root.className).toContain('h-[900px]')
  })

  it('survives every hook returning undefined on first paint', () => {
    useMusic.mockReturnValue({ state: { queues: [], activeQueue: null }, ...musicActions })
    useTopTracks.mockReturnValue({ data: undefined })
    useRecentlyPlayed.mockReturnValue({ data: undefined })
    usePlaylists.mockReturnValue({ data: undefined })
    useForYou.mockReturnValue({ data: undefined })
    expect(() => renderMedia()).not.toThrow()
  })

  it('shows the Quick Dials tab by default', () => {
    useTopTracks.mockReturnValue({
      data: [
        {
          uri: 'u1',
          name: 'Amber Hours',
          artist: 'The Night Shift',
          album: null,
          image_url: null,
          play_count: 1,
          last_played: 0,
        },
      ],
    })
    renderMedia()
    expect(screen.getByText('Frequently played')).toBeInTheDocument()
  })

  it('switches to the For You tab on tap', () => {
    useForYou.mockReturnValue({
      data: [{ name: 'Late Night Drive', description: 'Discover Weekly', uri: 'p1', image: null }],
    })
    renderMedia()
    fireEvent.click(screen.getByText('For You'))
    expect(screen.getByText('Late Night Drive')).toBeInTheDocument()
  })

  it('shows search results instead of the active tab once the query is long enough', async () => {
    useSearch.mockReturnValue({
      data: {
        tracks: [
          {
            name: 'Amber Hours',
            uri: 't1',
            media_type: 'track',
            artist: 'The Night Shift',
            image: null,
          },
        ],
        artists: [],
        albums: [],
        playlists: [],
      },
      isFetching: false,
    })
    renderMedia()
    fireEvent.change(screen.getByLabelText('Search music'), { target: { value: 'amber' } })
    await waitFor(() => expect(screen.getByText('Results')).toBeInTheDocument())
    expect(screen.queryByText('Frequently played')).not.toBeInTheDocument()
  })

  it('opens the Centre Spread on tapping the Now Spinning cover, and Close returns to the normal screen', () => {
    useMusic.mockReturnValue({
      state: {
        queues: [],
        activeQueue: {
          queueId: 'kitchen',
          displayName: 'Kitchen',
          state: 'playing',
          currentItem: {
            name: 'Amber Hours',
            artist: 'The Night Shift',
            album: 'Late Bloom',
            imageUrl: null,
            duration: 238,
            elapsed: 71,
            uri: 'u1',
          },
          volumeLevel: 45,
        },
      },
      ...musicActions,
    })
    renderMedia()
    expect(screen.getByTestId('broadsheet-media')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Open now playing'))
    expect(screen.getByTestId('broadsheet-centre-spread')).toBeInTheDocument()
    expect(screen.queryByTestId('broadsheet-media')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Close ✕'))
    expect(screen.getByTestId('broadsheet-media')).toBeInTheDocument()
    expect(screen.queryByTestId('broadsheet-centre-spread')).not.toBeInTheDocument()
  })

  it("opens a card's track-actions menu and dismisses it via the scrim", () => {
    useTopTracks.mockReturnValue({
      data: [
        {
          uri: 'u1',
          name: 'Amber Hours',
          artist: 'The Night Shift',
          album: null,
          image_url: null,
          play_count: 1,
          last_played: 0,
        },
      ],
    })
    renderMedia()
    fireEvent.click(screen.getByLabelText('Track actions'))
    expect(screen.getByText('Play track')).toBeInTheDocument()
    expect(screen.getByTestId('broadsheet-menu-scrim')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('broadsheet-menu-scrim'))
    expect(screen.queryByText('Play track')).not.toBeInTheDocument()
    expect(screen.queryByTestId('broadsheet-menu-scrim')).not.toBeInTheDocument()
  })

  it('closes an open track-actions menu when switching tabs', () => {
    useTopTracks.mockReturnValue({
      data: [
        {
          uri: 'u1',
          name: 'Amber Hours',
          artist: 'The Night Shift',
          album: null,
          image_url: null,
          play_count: 1,
          last_played: 0,
        },
      ],
    })
    renderMedia()
    fireEvent.click(screen.getByLabelText('Track actions'))
    expect(screen.getByTestId('broadsheet-menu-scrim')).toBeInTheDocument()

    fireEvent.click(screen.getByText('For You'))
    expect(screen.queryByTestId('broadsheet-menu-scrim')).not.toBeInTheDocument()
  })
})

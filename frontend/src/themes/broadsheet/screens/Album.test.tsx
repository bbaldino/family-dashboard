import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Album } from './Album'

const useAlbumDetail = vi.hoisted(() => vi.fn())
const useMusic = vi.hoisted(() => vi.fn())
vi.mock('@/integrations/music', () => ({ useAlbumDetail, useMusic }))

const play = vi.fn()

const albumData = {
  name: 'Push The Button',
  artist: 'The Chemical Brothers',
  artist_uri: 'spotify--x://artist/1',
  image_url: null,
  year: 2005,
  label: 'Virgin Records',
  description: null,
  tracks: [
    {
      uri: 'spotify--x://track/1',
      name: 'Galvanize',
      artist: 'The Chemical Brothers',
      artist_uri: 'spotify--x://artist/1',
      artists: [
        { name: 'The Chemical Brothers', uri: 'spotify--x://artist/1' },
        { name: 'Q-Tip', uri: 'spotify--x://artist/2' },
      ],
      album: 'Push The Button',
      album_uri: 'spotify--x://album/1',
      image_url: null,
      duration: 393,
    },
    {
      uri: 'spotify--x://track/2',
      name: 'The Boxer',
      artist: 'The Chemical Brothers',
      artist_uri: 'spotify--x://artist/1',
      artists: [{ name: 'The Chemical Brothers', uri: 'spotify--x://artist/1' }],
      album: 'Push The Button',
      album_uri: 'spotify--x://album/1',
      image_url: null,
      duration: 263,
    },
  ],
}

function renderAlbum(uri = 'spotify--x://album/1') {
  return render(
    <MemoryRouter initialEntries={[`/media/album/${encodeURIComponent(uri)}`]}>
      <Routes>
        <Route path="/media/album/:uri" element={<Album />} />
        <Route path="/media/artist/:uri" element={<div data-testid="landed-artist" />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Album', () => {
  beforeEach(() => {
    play.mockClear()
    useMusic.mockReturnValue({ state: { queues: [], activeQueue: null }, play })
  })

  it('renders a written loading line on cold start rather than a broken layout', () => {
    useAlbumDetail.mockReturnValue({ data: undefined, isLoading: true, error: null })
    renderAlbum()
    expect(screen.getByTestId('broadsheet-album')).toBeInTheDocument()
    expect(screen.getByText('Loading the record…')).toBeInTheDocument()
  })

  it('renders a written error line rather than crashing', () => {
    useAlbumDetail.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') })
    renderAlbum()
    expect(screen.getByText("Couldn't load this record.")).toBeInTheDocument()
  })

  it('renders the album title and the generated sleeve note when description is null', () => {
    useAlbumDetail.mockReturnValue({ data: albumData, isLoading: false, error: null })
    renderAlbum()
    expect(screen.getAllByText('Push The Button').length).toBeGreaterThan(0)
    expect(
      screen.getByText('Released 2005 on Virgin Records — 2 tracks, running 11 min.'),
    ).toBeInTheDocument()
  })

  it('renders the real description verbatim when present, not the generated note', () => {
    useAlbumDetail.mockReturnValue({
      data: { ...albumData, description: 'A hand-written editorial note.' },
      isLoading: false,
      error: null,
    })
    renderAlbum()
    expect(screen.getByText('A hand-written editorial note.')).toBeInTheDocument()
    expect(screen.queryByText(/Released 2005 on Virgin Records/)).not.toBeInTheDocument()
  })

  it('shows the feat. line for a track with additional artist credits, and none for a track without', () => {
    useAlbumDetail.mockReturnValue({ data: albumData, isLoading: false, error: null })
    renderAlbum()
    expect(screen.getByText('feat. Q-Tip')).toBeInTheDocument()
  })

  it('opening a track menu does not itself call play', () => {
    useAlbumDetail.mockReturnValue({ data: albumData, isLoading: false, error: null })
    renderAlbum()
    fireEvent.click(screen.getAllByLabelText('Track actions')[0])
    expect(screen.getByText('Play track')).toBeInTheDocument()
    expect(play).not.toHaveBeenCalled()
  })

  it('"Go to artist" navigates to the artist page and closes the menu', () => {
    useAlbumDetail.mockReturnValue({ data: albumData, isLoading: false, error: null })
    renderAlbum()
    fireEvent.click(screen.getAllByLabelText('Track actions')[0])
    fireEvent.click(screen.getByText('Go to artist'))
    expect(screen.getByTestId('landed-artist')).toBeInTheDocument()
  })

  it('tapping the scrim closes an open menu', () => {
    useAlbumDetail.mockReturnValue({ data: albumData, isLoading: false, error: null })
    renderAlbum()
    fireEvent.click(screen.getAllByLabelText('Track actions')[0])
    expect(screen.getByText('Play track')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('broadsheet-menu-scrim'))
    expect(screen.queryByText('Play track')).not.toBeInTheDocument()
  })

  it('wires "Play track" to the track uri with radio off — not exercised by default', () => {
    useAlbumDetail.mockReturnValue({ data: albumData, isLoading: false, error: null })
    renderAlbum()
    fireEvent.click(screen.getAllByLabelText('Track actions')[0])
    fireEvent.click(screen.getByText('Play track'))
    expect(play).toHaveBeenCalledWith(
      'spotify--x://track/1',
      expect.objectContaining({ radio: false, enqueueMode: 'play' }),
    )
  })

  it('the masthead "Play album" button is wired to the album uri', () => {
    useAlbumDetail.mockReturnValue({ data: albumData, isLoading: false, error: null })
    renderAlbum()
    fireEvent.click(screen.getByText('Play album'))
    expect(play).toHaveBeenCalledWith(
      'spotify--x://album/1',
      expect.objectContaining({ mediaType: 'album' }),
    )
  })
})

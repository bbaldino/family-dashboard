import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Artist } from './Artist'

const useArtistDetail = vi.hoisted(() => vi.fn())
const useMusic = vi.hoisted(() => vi.fn())
vi.mock('@/data/music', () => ({ useArtistDetail, useMusic }))

const play = vi.fn()

const artistData = {
  name: 'The Chemical Brothers',
  image_url: null,
  genres: ['breakbeat', 'big beat', 'electronic', 'electronica'],
  description: null,
  top_tracks: [
    {
      uri: 'spotify--x://track/1',
      name: 'Galvanize',
      artist: 'The Chemical Brothers',
      artist_uri: 'spotify--x://artist/1',
      artists: [{ name: 'The Chemical Brothers', uri: 'spotify--x://artist/1' }],
      album: 'Push The Button',
      album_uri: 'spotify--x://album/1',
      image_url: null,
      duration: 393,
    },
  ],
  albums: [
    { uri: 'spotify--x://album/1', name: 'Push The Button', image_url: null, year: 2005 },
    { uri: 'spotify--x://album/2', name: 'Surrender', image_url: null, year: 1999 },
  ],
}

function renderArtist(uri = 'spotify--x://artist/1') {
  return render(
    <MemoryRouter initialEntries={[`/media/artist/${encodeURIComponent(uri)}`]}>
      <Routes>
        <Route path="/media/artist/:uri" element={<Artist />} />
        <Route path="/media/album/:uri" element={<div data-testid="landed-album" />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Artist', () => {
  beforeEach(() => {
    play.mockClear()
    useMusic.mockReturnValue({ state: { queues: [], activeQueue: null }, play })
  })

  it('renders a written loading line on cold start', () => {
    useArtistDetail.mockReturnValue({ data: undefined, isLoading: true, error: null })
    renderArtist()
    expect(screen.getByTestId('broadsheet-artist')).toBeInTheDocument()
    expect(screen.getByText('Loading the profile…')).toBeInTheDocument()
  })

  it('renders a written error line rather than crashing', () => {
    useArtistDetail.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') })
    renderArtist()
    expect(screen.getByText("Couldn't load this artist.")).toBeInTheDocument()
  })

  it('renders the artist name and the generated standfirst from genres + album count when description is null', () => {
    useArtistDetail.mockReturnValue({ data: artistData, isLoading: false, error: null })
    renderArtist()
    expect(screen.getAllByText('The Chemical Brothers').length).toBeGreaterThan(0)
    expect(
      screen.getByText('Breakbeat, big beat, electronic, electronica — 2 albums in the library.'),
    ).toBeInTheDocument()
  })

  it('renders the real description verbatim when present, not the generated standfirst', () => {
    useArtistDetail.mockReturnValue({
      data: { ...artistData, description: 'A hand-written artist bio.' },
      isLoading: false,
      error: null,
    })
    renderArtist()
    expect(screen.getByText('A hand-written artist bio.')).toBeInTheDocument()
    expect(screen.queryByText(/albums in the library/)).not.toBeInTheDocument()
  })

  it('tapping an album in the discography rail navigates to that album', () => {
    useArtistDetail.mockReturnValue({ data: artistData, isLoading: false, error: null })
    renderArtist()
    fireEvent.click(screen.getByText('Surrender'))
    expect(screen.getByTestId('landed-album')).toBeInTheDocument()
  })

  it('opening a top-track menu does not itself call play', () => {
    useArtistDetail.mockReturnValue({ data: artistData, isLoading: false, error: null })
    renderArtist()
    fireEvent.click(screen.getByLabelText('Track actions'))
    expect(screen.getByText('Play radio from this')).toBeInTheDocument()
    expect(play).not.toHaveBeenCalled()
  })

  it('"Go to album" from a top track navigates to that track\'s album', () => {
    useArtistDetail.mockReturnValue({ data: artistData, isLoading: false, error: null })
    renderArtist()
    fireEvent.click(screen.getByLabelText('Track actions'))
    fireEvent.click(screen.getByText('Go to album'))
    expect(screen.getByTestId('landed-album')).toBeInTheDocument()
  })

  it('the masthead "Play radio" button is wired to the artist uri, radio true', () => {
    useArtistDetail.mockReturnValue({ data: artistData, isLoading: false, error: null })
    renderArtist()
    fireEvent.click(screen.getByText('Play radio'))
    expect(play).toHaveBeenCalledWith(
      'spotify--x://artist/1',
      expect.objectContaining({ radio: true, mediaType: 'artist' }),
    )
  })
})

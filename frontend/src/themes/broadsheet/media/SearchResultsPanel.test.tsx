import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SearchResultsPanel } from './SearchResultsPanel'

const useSearch = vi.hoisted(() => vi.fn())
const useMusic = vi.hoisted(() => vi.fn())
const getImageUrl = vi.hoisted(() => vi.fn(() => null))
vi.mock('@/data/music', () => ({ useSearch, useMusic, getImageUrl }))

const play = vi.fn()
const emptyResults = { tracks: [], artists: [], albums: [], playlists: [] }
const noopMenu = { openMenuUri: null, onToggleMenu: vi.fn(), onCloseMenu: vi.fn() }

function renderPanel(props: Partial<Parameters<typeof SearchResultsPanel>[0]> & { query: string }) {
  return render(
    <MemoryRouter>
      <SearchResultsPanel {...noopMenu} {...props} />
    </MemoryRouter>,
  )
}

describe('SearchResultsPanel', () => {
  beforeEach(() => {
    play.mockClear()
    useMusic.mockReturnValue({ play })
  })

  it('shows a searching indicator while the first fetch is in flight', () => {
    useSearch.mockReturnValue({ data: undefined, isFetching: true })
    renderPanel({ query: 'amber' })
    expect(screen.getByText(/searching/i)).toBeInTheDocument()
  })

  it('shows a written no-results line when the query matches nothing', () => {
    useSearch.mockReturnValue({ data: emptyResults, isFetching: false })
    renderPanel({ query: 'zzz' })
    expect(screen.getByText(/no results for/i)).toBeInTheDocument()
  })

  it('flattens all four buckets, tracks first, and plays a track with a radio continuation on tap', () => {
    useSearch.mockReturnValue({
      data: {
        tracks: [{ name: 'Amber Hours', uri: 't1', media_type: 'track', artist: 'The Night Shift', image: null }],
        albums: [{ name: 'Late Bloom', uri: 'al1', media_type: 'album', artist: 'The Night Shift', image: null }],
        artists: [{ name: 'The Night Shift', uri: 'ar1', media_type: 'artist', image: null }],
        playlists: [{ name: 'Late Night Drive', uri: 'p1', media_type: 'playlist', image: null }],
      },
      isFetching: false,
    })
    renderPanel({ query: 'night' })
    expect(screen.getByText('Results')).toBeInTheDocument()
    expect(screen.getByText('Amber Hours')).toBeInTheDocument()
    expect(screen.getByText('Late Bloom')).toBeInTheDocument()
    // The artist result has no artist field of its own, so its secondary
    // line falls back to a media-type label.
    expect(screen.getByText('Artist')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Amber Hours'))
    expect(play).toHaveBeenCalledWith('t1', expect.objectContaining({ radio: true }))
  })

  it('gives every result a track-actions trigger, one per row', () => {
    useSearch.mockReturnValue({
      data: {
        tracks: [{ name: 'Amber Hours', uri: 't1', media_type: 'track', artist: 'The Night Shift', image: null }],
        albums: [{ name: 'Late Bloom', uri: 'al1', media_type: 'album', artist: 'The Night Shift', artist_uri: 'ar1', image: null }],
        artists: [{ name: 'The Night Shift', uri: 'ar1', media_type: 'artist', image: null }],
        playlists: [{ name: 'Late Night Drive', uri: 'p1', media_type: 'playlist', image: null }],
      },
      isFetching: false,
    })
    renderPanel({ query: 'night' })
    expect(screen.getAllByLabelText('Track actions')).toHaveLength(4)
  })

  it('omits "Go to album" from an album result\'s menu (meaningless on its own row) but keeps "Go to artist"', () => {
    useSearch.mockReturnValue({
      data: {
        tracks: [],
        albums: [{ name: 'Late Bloom', uri: 'al1', media_type: 'album', artist: 'The Night Shift', artist_uri: 'ar1', image: null }],
        artists: [],
        playlists: [],
      },
      isFetching: false,
    })
    renderPanel({ query: 'bloom', openMenuUri: 'al1' })
    expect(screen.getByText('Go to artist')).toBeInTheDocument()
    expect(screen.queryByText('Go to album')).not.toBeInTheDocument()
    // An album's own tap already plays it start-to-finish, so the menu
    // doesn't repeat that as "Play just this track".
    expect(screen.queryByText('Play just this track')).not.toBeInTheDocument()
  })

  it('gives an artist result no "Go to" group at all', () => {
    useSearch.mockReturnValue({
      data: {
        tracks: [],
        albums: [],
        artists: [{ name: 'The Night Shift', uri: 'ar1', media_type: 'artist', image: null }],
        playlists: [],
      },
      isFetching: false,
    })
    renderPanel({ query: 'night', openMenuUri: 'ar1' })
    expect(screen.getByText('Play radio from this')).toBeInTheDocument()
    expect(screen.queryByText(/^Go to/)).not.toBeInTheDocument()
  })
})

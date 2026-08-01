import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchResultsPanel } from './SearchResultsPanel'

const useSearch = vi.hoisted(() => vi.fn())
const useMusic = vi.hoisted(() => vi.fn())
const getImageUrl = vi.hoisted(() => vi.fn(() => null))
vi.mock('@/data/music', () => ({ useSearch, useMusic, getImageUrl }))

const play = vi.fn()
const emptyResults = { tracks: [], artists: [], albums: [], playlists: [] }

describe('SearchResultsPanel', () => {
  beforeEach(() => {
    play.mockClear()
    useMusic.mockReturnValue({ play })
  })

  it('shows a searching indicator while the first fetch is in flight', () => {
    useSearch.mockReturnValue({ data: undefined, isFetching: true })
    render(<SearchResultsPanel query="amber" />)
    expect(screen.getByText(/searching/i)).toBeInTheDocument()
  })

  it('shows a written no-results line when the query matches nothing', () => {
    useSearch.mockReturnValue({ data: emptyResults, isFetching: false })
    render(<SearchResultsPanel query="zzz" />)
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
    render(<SearchResultsPanel query="night" />)
    expect(screen.getByText('Results')).toBeInTheDocument()
    expect(screen.getByText('Amber Hours')).toBeInTheDocument()
    expect(screen.getByText('Late Bloom')).toBeInTheDocument()
    // The artist result has no artist field of its own, so its secondary
    // line falls back to a media-type label.
    expect(screen.getByText('Artist')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Amber Hours'))
    expect(play).toHaveBeenCalledWith('t1', expect.objectContaining({ radio: true }))
  })
})

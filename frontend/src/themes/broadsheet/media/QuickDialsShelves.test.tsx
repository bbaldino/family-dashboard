import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QuickDialsShelves } from './QuickDialsShelves'

const useTopTracks = vi.hoisted(() => vi.fn())
const useRecentlyPlayed = vi.hoisted(() => vi.fn())
const useMusic = vi.hoisted(() => vi.fn())
vi.mock('@/data/music', () => ({ useTopTracks, useRecentlyPlayed, useMusic }))

const play = vi.fn()
const noopMenu = { openMenuUri: null, onToggleMenu: vi.fn(), onCloseMenu: vi.fn() }

function renderShelves(props: Partial<Parameters<typeof QuickDialsShelves>[0]> = {}) {
  return render(
    <MemoryRouter>
      <QuickDialsShelves {...noopMenu} {...props} />
    </MemoryRouter>,
  )
}

describe('QuickDialsShelves', () => {
  beforeEach(() => {
    play.mockClear()
    useMusic.mockReturnValue({ play })
  })

  it('shows a written line when both shelves are empty', () => {
    useTopTracks.mockReturnValue({ data: [] })
    useRecentlyPlayed.mockReturnValue({ data: [] })
    renderShelves()
    expect(screen.getByText(/build your quick dials/i)).toBeInTheDocument()
  })

  it('survives a cold cache where both hooks return undefined', () => {
    useTopTracks.mockReturnValue({ data: undefined })
    useRecentlyPlayed.mockReturnValue({ data: undefined })
    expect(() => renderShelves()).not.toThrow()
  })

  it('renders both shelves and plays a top track with a radio continuation on tap', () => {
    useTopTracks.mockReturnValue({
      data: [
        {
          uri: 'u1',
          name: 'Amber Hours',
          artist: 'The Night Shift',
          album: 'Late Bloom',
          image_url: null,
          play_count: 1,
          last_played: 0,
        },
      ],
    })
    useRecentlyPlayed.mockReturnValue({
      data: [{ uri: 'u2', name: 'Late Night Drive', media_type: 'playlist', image_url: null }],
    })
    renderShelves()
    expect(screen.getByText('Frequently played')).toBeInTheDocument()
    expect(screen.getByText('Recently played')).toBeInTheDocument()
    // The recent playlist has no artist, so its secondary line falls back
    // to a media-type label.
    expect(screen.getByText('Playlist')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Amber Hours'))
    expect(play).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ radio: true, name: 'Amber Hours' }),
    )
  })

  it('wires a track-actions trigger onto each card, open for the one matching openMenuUri', () => {
    useTopTracks.mockReturnValue({
      data: [
        {
          uri: 'u1',
          name: 'Amber Hours',
          artist: 'The Night Shift',
          album: 'Late Bloom',
          image_url: null,
          play_count: 1,
          last_played: 0,
        },
      ],
    })
    useRecentlyPlayed.mockReturnValue({ data: [] })
    renderShelves({ openMenuUri: 'frequently:u1' })
    expect(screen.getByLabelText('Track actions')).toBeInTheDocument()
    // Open, since the id matches this card's shelf-scoped id — its four track
    // play actions (top tracks are always tracks) are visible.
    expect(screen.getByText('Play just this track')).toBeInTheDocument()
    expect(screen.getByText('Play radio from this')).toBeInTheDocument()
  })

  it("scopes a card's menu id to its shelf, so the same track in two shelves opens independently", () => {
    const track = {
      uri: 'u1',
      name: 'Amber Hours',
      artist: 'The Night Shift',
      album: 'Late Bloom',
      image_url: null,
      play_count: 1,
      last_played: 0,
    }
    useTopTracks.mockReturnValue({ data: [track] })
    useRecentlyPlayed.mockReturnValue({
      data: [
        {
          uri: 'u1',
          name: 'Amber Hours',
          artist: 'The Night Shift',
          album: 'Late Bloom',
          image_url: null,
          media_type: 'track',
        },
      ],
    })
    // The same track sits in both shelves — a bare uri as the card id opened
    // both menus at once, and the second rendered clipped inside its shelf.
    renderShelves({ openMenuUri: 'frequently:u1' })
    expect(screen.getAllByLabelText('Track actions')).toHaveLength(2)
    expect(screen.getAllByText('Play just this track')).toHaveLength(1)
  })

  it("calls onToggleMenu with the tapped card's shelf-scoped id", () => {
    useTopTracks.mockReturnValue({
      data: [
        {
          uri: 'u1',
          name: 'Amber Hours',
          artist: 'The Night Shift',
          album: 'Late Bloom',
          image_url: null,
          play_count: 1,
          last_played: 0,
        },
      ],
    })
    useRecentlyPlayed.mockReturnValue({ data: [] })
    const onToggleMenu = vi.fn()
    renderShelves({ onToggleMenu })
    fireEvent.click(screen.getByLabelText('Track actions'))
    expect(onToggleMenu).toHaveBeenCalledWith('frequently:u1')
  })
})

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlaylistsShelf } from './PlaylistsShelf'
import { MAX_PLAYLISTS } from './playlists-capacity'
import type { Playlist } from '@/integrations/music'

const play = vi.hoisted(() => vi.fn())
const usePlaylists = vi.hoisted(() => vi.fn())
vi.mock('@/integrations/music', () => ({
  useMusic: () => ({ play }),
  usePlaylists,
}))

const playlist = (name: string, image_url: string | null = null): Playlist => ({
  uri: `library://playlist/${name.toLowerCase().replace(/\s+/g, '-')}`,
  name,
  image_url,
})

describe('PlaylistsShelf', () => {
  beforeEach(() => {
    play.mockClear()
    usePlaylists.mockReturnValue({ data: [playlist('Sunday Kitchen'), playlist('Late Shift')] })
  })

  it('lists the library playlists by name', () => {
    render(<PlaylistsShelf />)
    expect(screen.getByText('Playlists')).toBeInTheDocument()
    expect(screen.getByText('Sunday Kitchen')).toBeInTheDocument()
    expect(screen.getByText('Late Shift')).toBeInTheDocument()
  })

  it('plays a playlist when its card is tapped', () => {
    render(<PlaylistsShelf />)
    fireEvent.click(screen.getByText('Sunday Kitchen'))
    expect(play).toHaveBeenCalledWith(
      'library://playlist/sunday-kitchen',
      expect.objectContaining({ mediaType: 'playlist', name: 'Sunday Kitchen' }),
    )
  })

  it('renders nothing when there are no playlists', () => {
    // The standing rule against an empty heading over a blank grid.
    usePlaylists.mockReturnValue({ data: [] })
    const { container } = render(<PlaylistsShelf />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText('Playlists')).not.toBeInTheDocument()
  })

  it('renders nothing before the first fetch resolves', () => {
    usePlaylists.mockReturnValue({ data: undefined })
    const { container } = render(<PlaylistsShelf />)
    expect(container).toBeEmptyDOMElement()
  })

  it('caps the shelf so it cannot overrun the reclaimed band', () => {
    // The band holds two rows; more than the cap would clip against the
    // column's own `overflow: hidden`. See `playlists-capacity.ts`.
    const many = Array.from({ length: MAX_PLAYLISTS + 5 }, (_, i) => playlist(`List ${i}`))
    usePlaylists.mockReturnValue({ data: many })
    render(<PlaylistsShelf />)
    expect(screen.getByText(`List ${MAX_PLAYLISTS - 1}`)).toBeInTheDocument()
    expect(screen.queryByText(`List ${MAX_PLAYLISTS}`)).not.toBeInTheDocument()
  })

  it('draws real art when a playlist has an absolute-URL cover', () => {
    usePlaylists.mockReturnValue({
      data: [playlist('Liked Songs', 'https://i.scdn.co/image/real')],
    })
    const { container } = render(<PlaylistsShelf />)
    // The cover is a decorative `<img alt="">` (role presentation), so it is
    // queried by element, not role.
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://i.scdn.co/image/real')
  })

  it('falls back to a letter cover when a playlist has no art', () => {
    usePlaylists.mockReturnValue({ data: [playlist('Sunday Kitchen', null)] })
    const { container } = render(<PlaylistsShelf />)
    // The letter placeholder is not an <img>; the name still shows.
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('Sunday Kitchen')).toBeInTheDocument()
  })
})

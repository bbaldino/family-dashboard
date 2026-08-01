import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ArtistTrackRow } from './ArtistTrackRow'

const track = {
  uri: 'fixture://track/1',
  name: 'Galvanize',
  artist: 'The Chemical Brothers',
  artist_uri: 'fixture://artist/1',
  artists: [{ name: 'The Chemical Brothers', uri: 'fixture://artist/1' }],
  album: 'Push The Button',
  album_uri: 'fixture://album/1',
  image_url: null,
  duration: 393,
}

describe('ArtistTrackRow', () => {
  it('renders the track title and its album line', () => {
    render(<ArtistTrackRow track={track} isFirstInColumn isPlaying={false} isMenuOpen={false} onToggleMenu={vi.fn()} groups={[]} />)
    expect(screen.getByText('Galvanize')).toBeInTheDocument()
    expect(screen.getByText('Push The Button')).toBeInTheDocument()
  })

  it('omits the album line when the track has none', () => {
    render(<ArtistTrackRow track={{ ...track, album: null }} isFirstInColumn isPlaying={false} isMenuOpen={false} onToggleMenu={vi.fn()} groups={[]} />)
    expect(screen.queryByText('Push The Button')).not.toBeInTheDocument()
  })

  it('formats duration as m:ss', () => {
    render(<ArtistTrackRow track={track} isFirstInColumn isPlaying={false} isMenuOpen={false} onToggleMenu={vi.fn()} groups={[]} />)
    expect(screen.getByText('6:33')).toBeInTheDocument()
  })
})

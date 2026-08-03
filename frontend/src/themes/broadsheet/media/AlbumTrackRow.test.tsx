import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AlbumTrackRow } from './AlbumTrackRow'

const track = {
  uri: 'fixture://track/1',
  name: 'Galvanize',
  artist: 'The Chemical Brothers',
  artist_uri: 'fixture://artist/1',
  artists: [
    { name: 'The Chemical Brothers', uri: 'fixture://artist/1' },
    { name: 'Q-Tip', uri: 'fixture://artist/2' },
  ],
  album: 'Push The Button',
  album_uri: 'fixture://album/1',
  image_url: null,
  duration: 393,
}

describe('AlbumTrackRow', () => {
  it('shows a mono track number, not the playing glyph, when not playing', () => {
    render(
      <AlbumTrackRow
        track={track}
        index={0}
        isPlaying={false}
        isMenuOpen={false}
        onToggleMenu={vi.fn()}
        groups={[]}
      />,
    )
    expect(screen.getByText('01')).toBeInTheDocument()
  })

  it('shows the rust ▸ glyph in place of the number when playing', () => {
    render(
      <AlbumTrackRow
        track={track}
        index={0}
        isPlaying
        isMenuOpen={false}
        onToggleMenu={vi.fn()}
        groups={[]}
      />,
    )
    expect(screen.getByText('▸')).toBeInTheDocument()
    expect(screen.queryByText('01')).not.toBeInTheDocument()
  })

  it('shows the feat. line built from artists beyond the first', () => {
    render(
      <AlbumTrackRow
        track={track}
        index={0}
        isPlaying={false}
        isMenuOpen={false}
        onToggleMenu={vi.fn()}
        groups={[]}
      />,
    )
    expect(screen.getByText('feat. Q-Tip')).toBeInTheDocument()
  })

  it('omits the feat. line for a track with only its own artist', () => {
    const soloTrack = {
      ...track,
      artists: [{ name: 'The Chemical Brothers', uri: 'fixture://artist/1' }],
    }
    render(
      <AlbumTrackRow
        track={soloTrack}
        index={0}
        isPlaying={false}
        isMenuOpen={false}
        onToggleMenu={vi.fn()}
        groups={[]}
      />,
    )
    expect(screen.queryByText(/^feat\./)).not.toBeInTheDocument()
  })

  it('formats duration as m:ss', () => {
    render(
      <AlbumTrackRow
        track={track}
        index={0}
        isPlaying={false}
        isMenuOpen={false}
        onToggleMenu={vi.fn()}
        groups={[]}
      />,
    )
    expect(screen.getByText('6:33')).toBeInTheDocument()
  })
})

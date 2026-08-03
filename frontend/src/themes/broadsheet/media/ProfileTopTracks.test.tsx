import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProfileTopTracks } from './ProfileTopTracks'
import { MAX_TOP_TRACKS } from './profile-capacity'

function track(i: number) {
  return {
    uri: `fixture://track/${i}`,
    name: `Track ${i}`,
    artist: 'Some Artist',
    artist_uri: 'fixture://artist/1',
    artists: [{ name: 'Some Artist', uri: 'fixture://artist/1' }],
    album: 'Some Album',
    album_uri: 'fixture://album/1',
    image_url: null,
    duration: 200,
  }
}

const noGroups = () => []

describe('ProfileTopTracks', () => {
  it('renders every track under the cap with no "+N more" line', () => {
    const tracks = Array.from({ length: 3 }, (_, i) => track(i + 1))
    render(
      <ProfileTopTracks
        tracks={tracks}
        currentTrackUri={null}
        openMenuUri={null}
        onToggleMenu={vi.fn()}
        buildGroups={noGroups}
      />,
    )
    expect(screen.getByText('Track 1')).toBeInTheDocument()
    expect(screen.queryByText(/more tracks/)).not.toBeInTheDocument()
  })

  it('caps a long top-tracks list and names the remainder', () => {
    const tracks = Array.from({ length: 40 }, (_, i) => track(i + 1))
    render(
      <ProfileTopTracks
        tracks={tracks}
        currentTrackUri={null}
        openMenuUri={null}
        onToggleMenu={vi.fn()}
        buildGroups={noGroups}
      />,
    )
    expect(screen.getByText(`Track ${MAX_TOP_TRACKS}`)).toBeInTheDocument()
    expect(screen.queryByText(`Track ${MAX_TOP_TRACKS + 1}`)).not.toBeInTheDocument()
    expect(screen.getByText(`+${40 - MAX_TOP_TRACKS} more tracks`)).toBeInTheDocument()
  })
})

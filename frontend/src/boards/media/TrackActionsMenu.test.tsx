import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TrackActionsMenu, type TrackLike } from './TrackActionsMenu'

const noop = () => {}
const baseTrack: TrackLike = {
  uri: 'spotify--x://track/1',
  media_type: 'track',
  name: 'Go',
  artist: 'The Chemical Brothers',
  artist_uri: 'spotify--x://artist/1',
  album: 'Born In The Echoes',
  album_uri: 'spotify--x://album/1',
}

function renderMenu(overrides: Partial<TrackLike> = {}, callbacks: Partial<React.ComponentProps<typeof TrackActionsMenu>> = {}) {
  const props = {
    item: { ...baseTrack, ...overrides },
    onPlayRadio: noop,
    onPlayJustThis: noop,
    onPlayNext: noop,
    onAddToQueue: noop,
    onGoToArtist: noop,
    onGoToAlbum: noop,
    ...callbacks,
  }
  return render(<TrackActionsMenu {...props} />)
}

describe('TrackActionsMenu', () => {
  it('shows all six actions for a track with both URIs', () => {
    renderMenu()
    fireEvent.click(screen.getByLabelText('More play options'))
    expect(screen.getByText('Play radio from this')).toBeInTheDocument()
    expect(screen.getByText('Play just this track')).toBeInTheDocument()
    expect(screen.getByText('Play next')).toBeInTheDocument()
    expect(screen.getByText('Add to queue')).toBeInTheDocument()
    expect(screen.getByText('Go to artist')).toBeInTheDocument()
    expect(screen.getByText('Go to album')).toBeInTheDocument()
  })

  it('hides Go to album when album_uri is missing', () => {
    renderMenu({ album_uri: null })
    fireEvent.click(screen.getByLabelText('More play options'))
    expect(screen.queryByText('Go to album')).not.toBeInTheDocument()
    expect(screen.getByText('Go to artist')).toBeInTheDocument()
  })

  it('hides all four play actions for a non-track, keeps nav', () => {
    renderMenu({ media_type: 'playlist' })
    fireEvent.click(screen.getByLabelText('More play options'))
    expect(screen.queryByText('Play radio from this')).not.toBeInTheDocument()
    expect(screen.queryByText('Play just this track')).not.toBeInTheDocument()
    expect(screen.queryByText('Play next')).not.toBeInTheDocument()
    expect(screen.queryByText('Add to queue')).not.toBeInTheDocument()
    expect(screen.getByText('Go to artist')).toBeInTheDocument()
  })

  it('renders nothing for a playlist row with no URIs to nav to', () => {
    const { container } = renderMenu({ media_type: 'playlist', artist_uri: null, album_uri: null })
    expect(container.firstChild).toBeNull()
  })

  it('invokes the right callback for each action and closes the menu', () => {
    const onPlayNext = vi.fn()
    renderMenu({}, { onPlayNext })
    fireEvent.click(screen.getByLabelText('More play options'))
    fireEvent.click(screen.getByText('Play next'))
    expect(onPlayNext).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Play next')).not.toBeInTheDocument()
  })
})

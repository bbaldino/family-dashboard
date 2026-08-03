import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecordRunningOrder } from './RecordRunningOrder'
import { MAX_RECORD_TRACKS } from './record-capacity'

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

describe('RecordRunningOrder', () => {
  it('renders every track and no "+N more" line when under the cap', () => {
    const tracks = Array.from({ length: 4 }, (_, i) => track(i + 1))
    render(
      <RecordRunningOrder
        tracks={tracks}
        currentTrackUri={null}
        openMenuUri={null}
        onToggleMenu={vi.fn()}
        buildGroups={noGroups}
      />,
    )
    expect(screen.getByText('Track 1')).toBeInTheDocument()
    expect(screen.getByText('Track 4')).toBeInTheDocument()
    expect(screen.queryByText(/more tracks/)).not.toBeInTheDocument()
  })

  it('caps a 30-track album at MAX_RECORD_TRACKS and names the remainder', () => {
    const tracks = Array.from({ length: 30 }, (_, i) => track(i + 1))
    render(
      <RecordRunningOrder
        tracks={tracks}
        currentTrackUri={null}
        openMenuUri={null}
        onToggleMenu={vi.fn()}
        buildGroups={noGroups}
      />,
    )
    expect(screen.getByText(`Track ${MAX_RECORD_TRACKS}`)).toBeInTheDocument()
    expect(screen.queryByText(`Track ${MAX_RECORD_TRACKS + 1}`)).not.toBeInTheDocument()
    expect(screen.getByText(`+${30 - MAX_RECORD_TRACKS} more tracks`)).toBeInTheDocument()
  })

  it('the header count/runtime always describes the whole album, not just the visible rows', () => {
    const tracks = Array.from({ length: 30 }, (_, i) => track(i + 1))
    render(
      <RecordRunningOrder
        tracks={tracks}
        currentTrackUri={null}
        openMenuUri={null}
        onToggleMenu={vi.fn()}
        buildGroups={noGroups}
      />,
    )
    expect(screen.getByText(/30 tracks/)).toBeInTheDocument()
  })

  it('splits visible tracks across exactly two columns', () => {
    const tracks = Array.from({ length: 5 }, (_, i) => track(i + 1))
    const { container } = render(
      <RecordRunningOrder
        tracks={tracks}
        currentTrackUri={null}
        openMenuUri={null}
        onToggleMenu={vi.fn()}
        buildGroups={noGroups}
      />,
    )
    const section = container.querySelector('section')!
    const grid = section.children[1]
    expect(grid.children).toHaveLength(2)
  })
})

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CentreSpreadMasthead } from './CentreSpreadMasthead'

describe('CentreSpreadMasthead', () => {
  it('shows the room, track title, and "Side A · Track {n}" when a track number is present', () => {
    const onClose = vi.fn()
    render(
      <CentreSpreadMasthead
        room="Kitchen"
        playbackState="playing"
        trackTitle="Amber Hours"
        trackNumber={4}
        onClose={onClose}
      />,
    )
    expect(screen.getByText('Now playing in the Kitchen')).toBeInTheDocument()
    expect(screen.getByText('Amber Hours')).toBeInTheDocument()
    expect(screen.getByText('Side A · Track 4')).toBeInTheDocument()
  })

  it('drops the "Track {n}" clause — never "of {m}" — when there is no track number', () => {
    const onClose = vi.fn()
    render(
      <CentreSpreadMasthead
        room="Kitchen"
        playbackState="playing"
        trackTitle="Amber Hours"
        trackNumber={null}
        onClose={onClose}
      />,
    )
    expect(screen.getByText('Side A')).toBeInTheDocument()
    expect(screen.queryByText(/of \d/)).not.toBeInTheDocument()
  })

  it('falls back to a roomless "Now playing" when there is no room', () => {
    const onClose = vi.fn()
    render(
      <CentreSpreadMasthead
        room={null}
        playbackState="playing"
        trackTitle="Amber Hours"
        trackNumber={1}
        onClose={onClose}
      />,
    )
    expect(screen.getByText('Now playing')).toBeInTheDocument()
  })

  // Both mastheads used to claim playback regardless of state — the queue
  // behind the reported "Now playing in the Deck" was in fact paused.
  it('says a paused room is paused rather than claiming playback', () => {
    render(
      <CentreSpreadMasthead
        room="Kitchen + Deck"
        playbackState="paused"
        trackTitle="Amber Hours"
        trackNumber={1}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Paused in the Kitchen + Deck')).toBeInTheDocument()
  })

  it('calls onClose when Close is tapped', () => {
    const onClose = vi.fn()
    render(
      <CentreSpreadMasthead
        room="Kitchen"
        playbackState="playing"
        trackTitle="Amber Hours"
        trackNumber={1}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByText('Close ✕'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

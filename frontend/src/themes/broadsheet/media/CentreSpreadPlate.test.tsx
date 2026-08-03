import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CentreSpreadPlate } from './CentreSpreadPlate'

const fullTrack = {
  name: 'Amber Hours',
  artist: 'The Night Shift',
  album: 'Late Bloom',
  imageUrl: null,
  duration: 238,
  elapsed: 71,
  uri: 'u1',
  year: 2023,
  label: 'Harbor Sound Records',
  trackNumber: 1,
  source: 'spotify--yC8brUbw',
}

function noopHandlers() {
  return { onPause: vi.fn(), onResume: vi.fn(), onNext: vi.fn(), onPrevious: vi.fn() }
}

describe('CentreSpreadPlate', () => {
  it('tags the plate "PLATE I" as a fixed decorative flourish', () => {
    render(<CentreSpreadPlate track={fullTrack} isPlaying {...noopHandlers()} />)
    expect(screen.getByText('PLATE I')).toBeInTheDocument()
  })

  it('builds the caption with album/year/artist/track, and no Label or "of {m}" clause', () => {
    const { container } = render(
      <CentreSpreadPlate track={fullTrack} isPlaying {...noopHandlers()} />,
    )
    expect(container.textContent).toContain('Late Bloom, 2023 — The Night Shift. Track 1.')
    expect(container.textContent).not.toContain('Harbor Sound Records')
    expect(container.textContent).not.toContain('of 11')
  })

  it('drops the year clause when year is absent but keeps the rest', () => {
    const track = { ...fullTrack, year: null }
    const { container } = render(<CentreSpreadPlate track={track} isPlaying {...noopHandlers()} />)
    expect(container.textContent).toContain('Late Bloom — The Night Shift. Track 1.')
  })

  it('drops the album clause entirely (no dangling em dash) when album is absent', () => {
    const track = { ...fullTrack, album: null }
    const { container } = render(<CentreSpreadPlate track={track} isPlaying {...noopHandlers()} />)
    expect(container.textContent).toContain('The Night Shift. Track 1.')
    expect(container.textContent).not.toContain('—')
  })

  it('ends with a bare period when trackNumber is absent', () => {
    const track = { ...fullTrack, trackNumber: null }
    const { container } = render(<CentreSpreadPlate track={track} isPlaying {...noopHandlers()} />)
    expect(container.textContent).toContain('The Night Shift.')
    expect(container.textContent).not.toContain('Track')
  })

  it('renders a plain progress fill with no draggable handle', () => {
    render(<CentreSpreadPlate track={fullTrack} isPlaying {...noopHandlers()} />)
    const track = screen.getByTestId('centre-spread-progress-track')
    // Only the fill bar — no second (handle) child.
    expect(track.children.length).toBe(1)
  })

  it('wires transport to the given callbacks based on isPlaying', () => {
    const handlers = noopHandlers()
    const { rerender } = render(<CentreSpreadPlate track={fullTrack} isPlaying {...handlers} />)
    screen.getByLabelText('Pause').click()
    expect(handlers.onPause).toHaveBeenCalledTimes(1)
    screen.getByLabelText('Next track').click()
    expect(handlers.onNext).toHaveBeenCalledTimes(1)
    screen.getByLabelText('Previous track').click()
    expect(handlers.onPrevious).toHaveBeenCalledTimes(1)

    rerender(<CentreSpreadPlate track={fullTrack} isPlaying={false} {...handlers} />)
    screen.getByLabelText('Play').click()
    expect(handlers.onResume).toHaveBeenCalledTimes(1)
  })
})

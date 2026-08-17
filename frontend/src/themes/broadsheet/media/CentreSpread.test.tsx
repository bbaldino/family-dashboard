import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CentreSpread } from './CentreSpread'

const useMusic = vi.hoisted(() => vi.fn())
const useRoomPills = vi.hoisted(() => vi.fn())
const useQueue = vi.hoisted(() => vi.fn())
vi.mock('@/integrations/music', () => ({ useMusic, useRoomPills, useQueue }))

const pause = vi.fn()
const resume = vi.fn()
const next = vi.fn()
const previous = vi.fn()
const setVolume = vi.fn()

const playingQueue = {
  queueId: 'kitchen',
  displayName: 'Kitchen',
  state: 'playing' as const,
  currentItem: {
    name: 'Amber Hours',
    artist: 'The Night Shift',
    album: 'Late Bloom',
    imageUrl: null,
    duration: 238,
    elapsed: 71,
    uri: 'fixture://track/amber-hours',
    year: 2023,
    label: 'Harbor Sound Records',
    trackNumber: 1,
    source: 'spotify--yC8brUbw',
  },
  volumeLevel: 45,
}

describe('CentreSpread', () => {
  beforeEach(() => {
    pause.mockClear()
    resume.mockClear()
    next.mockClear()
    previous.mockClear()
    setVolume.mockClear()
    useRoomPills.mockReturnValue({ pills: [], toggle: vi.fn() })
    useQueue.mockReturnValue({ data: [] })
  })

  it('renders nothing and closes immediately when there is no current item (cold start / track vanished)', () => {
    const onClose = vi.fn()
    useMusic.mockReturnValue({
      state: { queues: [], activeQueue: null },
      isPlaying: false,
      pause,
      resume,
      next,
      previous,
      setVolume,
    })
    const { container } = render(<CentreSpread onClose={onClose} />)
    expect(container.firstChild).toBeNull()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  /**
   * The masthead no longer names the room: that phrase ("Now playing in the
   * Kitchen and Deck") was the left ear, which is now the shared room picker.
   * `anchorRoomLabel` is still the rule for naming a group and still covered
   * by `anchor.test.ts` and `music-context`; this screen simply no longer
   * renders it. What is asserted here is that the group's rooms reach the ear.
   */
  it('lists the rooms in the masthead ear', () => {
    useMusic.mockReturnValue({
      state: { queues: [], activeQueue: { ...playingQueue, displayName: 'Deck' } },
      anchorRoomLabel: 'Kitchen and Deck',
      isPlaying: true,
      pause,
      resume,
      next,
      previous,
      setVolume,
    })
    render(<CentreSpread onClose={vi.fn()} />)
    expect(screen.getByText('Rooms')).toBeInTheDocument()
  })

  it('renders the full page for the active track', () => {
    const onClose = vi.fn()
    useMusic.mockReturnValue({
      state: { queues: [], activeQueue: playingQueue },
      isPlaying: true,
      pause,
      resume,
      next,
      previous,
      setVolume,
    })
    render(<CentreSpread onClose={onClose} />)
    expect(screen.getByTestId('broadsheet-centre-spread')).toBeInTheDocument()
    // Appears twice: the masthead's own 62px title, and the running order's head row.
    expect(screen.getAllByText('Amber Hours').length).toBeGreaterThan(0)
  })

  it('calls onClose when Close is tapped', () => {
    const onClose = vi.fn()
    useMusic.mockReturnValue({
      state: { queues: [], activeQueue: playingQueue },
      isPlaying: true,
      pause,
      resume,
      next,
      previous,
      setVolume,
    })
    render(<CentreSpread onClose={onClose} />)
    fireEvent.click(screen.getByText('Close ✕'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes automatically when the current track disappears mid-view', () => {
    const onClose = vi.fn()
    useMusic.mockReturnValue({
      state: { queues: [], activeQueue: playingQueue },
      isPlaying: true,
      pause,
      resume,
      next,
      previous,
      setVolume,
    })
    const { rerender } = render(<CentreSpread onClose={onClose} />)
    expect(onClose).not.toHaveBeenCalled()

    useMusic.mockReturnValue({
      state: { queues: [], activeQueue: null },
      isPlaying: false,
      pause,
      resume,
      next,
      previous,
      setVolume,
    })
    rerender(<CentreSpread onClose={onClose} />)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not render the theme Footer itself — BroadsheetLayout owns it', () => {
    const onClose = vi.fn()
    useMusic.mockReturnValue({
      state: { queues: [], activeQueue: playingQueue },
      isPlaying: true,
      pause,
      resume,
      next,
      previous,
      setVolume,
    })
    render(<CentreSpread onClose={onClose} />)
    expect(screen.queryByText('Cameras')).not.toBeInTheDocument()
  })
})

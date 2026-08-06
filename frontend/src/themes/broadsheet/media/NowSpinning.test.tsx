import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NowSpinning } from './NowSpinning'

const useMusic = vi.hoisted(() => vi.fn())
vi.mock('@/integrations/music', () => ({ useMusic }))

const pause = vi.fn()
const resume = vi.fn()
const next = vi.fn()
const previous = vi.fn()
const setVolume = vi.fn()

describe('NowSpinning', () => {
  beforeEach(() => {
    pause.mockClear()
    resume.mockClear()
    next.mockClear()
    previous.mockClear()
    setVolume.mockClear()
  })

  it('shows a written fallback when nothing is playing', () => {
    useMusic.mockReturnValue({
      state: { queues: [], activeQueue: null },
      isPlaying: false,
      pause,
      resume,
      next,
      previous,
      setVolume,
    })
    render(<NowSpinning />)
    expect(screen.getByText('Nothing on the platter.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Play')).not.toBeInTheDocument()
  })

  it('renders the current track and calls pause when playing', () => {
    useMusic.mockReturnValue({
      state: {
        queues: [],
        activeQueue: {
          queueId: 'kitchen',
          displayName: 'Kitchen',
          state: 'playing',
          currentItem: {
            name: 'Black Steel',
            artist: 'Tricky',
            album: 'Maxinquaye',
            imageUrl: null,
            duration: 340,
            elapsed: 294,
            uri: 'u1',
          },
          volumeLevel: 62,
        },
      },
      isPlaying: true,
      pause,
      resume,
      next,
      previous,
      setVolume,
    })
    render(<NowSpinning />)
    expect(screen.getByText('Black Steel')).toBeInTheDocument()
    expect(screen.getByText('62')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Pause'))
    expect(pause).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByLabelText('Next track'))
    expect(next).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByLabelText('Previous track'))
    expect(previous).toHaveBeenCalledTimes(1)
  })

  it('shows resume affordance and calls resume when paused', () => {
    useMusic.mockReturnValue({
      state: {
        queues: [],
        activeQueue: {
          queueId: 'kitchen',
          displayName: 'Kitchen',
          state: 'paused',
          currentItem: {
            name: 'Black Steel',
            artist: 'Tricky',
            album: null,
            imageUrl: null,
            duration: 0,
            elapsed: null,
            uri: 'u1',
          },
          volumeLevel: null,
        },
      },
      isPlaying: false,
      pause,
      resume,
      next,
      previous,
      setVolume,
    })
    render(<NowSpinning />)
    fireEvent.click(screen.getByLabelText('Play'))
    expect(resume).toHaveBeenCalledTimes(1)
  })

  it('opens the Centre Spread when the cover is tapped, and has no tap target when nothing is playing', () => {
    const onOpenCentreSpread = vi.fn()
    useMusic.mockReturnValue({
      state: { queues: [], activeQueue: null },
      isPlaying: false,
      pause,
      resume,
      next,
      previous,
      setVolume,
    })
    const { rerender } = render(<NowSpinning onOpenCentreSpread={onOpenCentreSpread} />)
    expect(screen.queryByLabelText('Open now playing')).not.toBeInTheDocument()

    useMusic.mockReturnValue({
      state: {
        queues: [],
        activeQueue: {
          queueId: 'kitchen',
          displayName: 'Kitchen',
          state: 'playing',
          currentItem: {
            name: 'Black Steel',
            artist: 'Tricky',
            album: 'Maxinquaye',
            imageUrl: null,
            duration: 340,
            elapsed: 294,
            uri: 'u1',
          },
          volumeLevel: 62,
        },
      },
      isPlaying: true,
      pause,
      resume,
      next,
      previous,
      setVolume,
    })
    rerender(<NowSpinning onOpenCentreSpread={onOpenCentreSpread} />)
    fireEvent.click(screen.getByLabelText('Open now playing'))
    expect(onOpenCentreSpread).toHaveBeenCalledTimes(1)
  })

  it('sets volume from a tap position on the volume bar', () => {
    useMusic.mockReturnValue({
      state: {
        queues: [],
        activeQueue: {
          queueId: 'kitchen',
          displayName: 'Kitchen',
          state: 'playing',
          currentItem: {
            name: 'Black Steel',
            artist: 'Tricky',
            album: null,
            imageUrl: null,
            duration: 100,
            elapsed: 10,
            uri: 'u1',
          },
          volumeLevel: 20,
        },
      },
      isPlaying: true,
      pause,
      resume,
      next,
      previous,
      setVolume,
    })
    render(<NowSpinning />)
    const slider = screen.getByLabelText('Volume')
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 100,
      top: 0,
      right: 100,
      bottom: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    })
    fireEvent.click(slider, { clientX: 50 })
    expect(setVolume).toHaveBeenCalledWith('kitchen', 50)
  })
})

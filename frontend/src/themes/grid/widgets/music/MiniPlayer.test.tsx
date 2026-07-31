import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MiniPlayer } from './MiniPlayer'
import type { MusicContextValue } from '@/data/music'
import type { QueueState } from '@/data/music'

const useMusic = vi.hoisted(() => vi.fn())
vi.mock('@/data/music', () => ({ useMusic }))

function queue(state: QueueState['state']): QueueState {
  return {
    queueId: 'q1',
    displayName: 'Kitchen',
    state,
    currentItem: {
      name: 'Go',
      artist: 'The Chemical Brothers',
      album: 'Further',
      imageUrl: null,
      duration: null,
      elapsed: null,
      uri: 'spotify://track/1',
    },
    volumeLevel: 30,
  }
}

function mockMusic(activeQueue: QueueState | null) {
  useMusic.mockReturnValue({
    state: { queues: activeQueue ? [activeQueue] : [], activeQueue },
    isPlaying: activeQueue?.state === 'playing',
    isConnected: true,
    play: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
    next: vi.fn(),
    previous: vi.fn(),
    setVolume: vi.fn(),
  } satisfies MusicContextValue)
}

function renderPlayer() {
  return render(
    <MemoryRouter>
      <MiniPlayer />
    </MemoryRouter>,
  )
}

const trackName = () => screen.queryByText('Go')

describe('MiniPlayer', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('renders nothing when there is no active queue', () => {
    mockMusic(null)
    renderPlayer()

    expect(trackName()).toBeNull()
  })

  it('shows the current track while a queue is active', () => {
    mockMusic(queue('playing'))
    renderPlayer()

    expect(trackName()).not.toBeNull()
    expect(screen.getByText('Kitchen')).toBeInTheDocument()
  })

  it('hides when dismissed and stays hidden while the play state is unchanged', () => {
    mockMusic(queue('playing'))
    const { rerender } = renderPlayer()

    fireEvent.click(screen.getAllByRole('button').at(-1)!)
    expect(trackName()).toBeNull()

    rerender(
      <MemoryRouter>
        <MiniPlayer />
      </MemoryRouter>,
    )
    expect(trackName()).toBeNull()
  })

  it('reappears when playback starts again after being dismissed', () => {
    mockMusic(queue('playing'))
    const { rerender } = renderPlayer()

    fireEvent.click(screen.getAllByRole('button').at(-1)!)
    expect(trackName()).toBeNull()

    // Playback pauses, then resumes — the rising edge should bring it back.
    mockMusic(queue('paused'))
    rerender(
      <MemoryRouter>
        <MiniPlayer />
      </MemoryRouter>,
    )
    expect(trackName()).toBeNull()

    mockMusic(queue('playing'))
    rerender(
      <MemoryRouter>
        <MiniPlayer />
      </MemoryRouter>,
    )
    expect(trackName()).not.toBeNull()
  })

  it('auto-dismisses after five idle minutes, and comes back on the next play', () => {
    mockMusic(queue('paused'))
    const { rerender } = renderPlayer()
    expect(trackName()).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000)
    })
    expect(trackName()).toBeNull()

    mockMusic(queue('playing'))
    rerender(
      <MemoryRouter>
        <MiniPlayer />
      </MemoryRouter>,
    )
    expect(trackName()).not.toBeNull()
  })

  it('does not auto-dismiss while playback continues', () => {
    mockMusic(queue('playing'))
    renderPlayer()

    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000)
    })
    expect(trackName()).not.toBeNull()
  })
})

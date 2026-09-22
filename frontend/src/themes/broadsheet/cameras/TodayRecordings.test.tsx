import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { TodayRecordings } from './TodayRecordings'

// Backend visit payload (snake_case): `clips` carries each Frigate clip's
// event id + start time; `snapshot_event_id` is the representative clip.
const visit = (id: string, clipIds: string[] = [id]) => ({
  id,
  start: 0,
  end: clipIds.length,
  count: clipIds.length,
  clips: clipIds.map((c, i) => ({ event_id: c, start: i })),
  snapshot_event_id: clipIds[0],
  duration_s: clipIds.length,
})
function stub(payload: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(payload) }))
}
const clipButtons = () => screen.getAllByRole('button').filter((b) => b.className.includes('clip'))
afterEach(() => vi.unstubAllGlobals())

describe('TodayRecordings', () => {
  it('shows a placeholder until a visit is picked, then loads that visit’s clip without autoplay', async () => {
    stub({ visits: [visit('a'), visit('b')] })
    render(<TodayRecordings />)
    await waitFor(() => expect(screen.getByTestId('player-placeholder')).toBeInTheDocument())
    expect(document.querySelector('video')).toBeNull()

    fireEvent.click(screen.getAllByRole('button')[1]) // pick the 2nd visit
    const video = document.querySelector('video') as HTMLVideoElement
    expect(video.getAttribute('src')).toContain('/api/cameras/clip/b')
    expect(video.hasAttribute('autoplay')).toBe(false)
    expect(screen.queryByTestId('player-placeholder')).not.toBeInTheDocument()
  })

  it('expands a multi-clip visit and plays the clip you pick', async () => {
    stub({ visits: [visit('m', ['m1', 'm2', 'm3'])] })
    render(<TodayRecordings />)
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1))

    fireEvent.click(screen.getAllByRole('button')[0]) // expand + load representative (m1)
    expect(document.querySelector('video')?.getAttribute('src')).toContain('/api/cameras/clip/m1')
    expect(clipButtons()).toHaveLength(3)

    fireEvent.click(clipButtons()[2]) // pick clip #3
    expect(document.querySelector('video')?.getAttribute('src')).toContain('/api/cameras/clip/m3')
  })

  it('shows the empty state when nobody has been by', async () => {
    stub({ visits: [] })
    render(<TodayRecordings />)
    await waitFor(() => expect(screen.getByText(/no one/i)).toBeInTheDocument())
  })

  it('shows the error state when the feed is down', async () => {
    stub({}, false)
    render(<TodayRecordings />)
    await waitFor(() => expect(screen.getByText(/couldn.t reach/i)).toBeInTheDocument())
  })
})

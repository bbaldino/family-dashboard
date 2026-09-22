import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { TodayRecordings } from './TodayRecordings'

const visit = (id: string, count = 1) => ({
  id,
  start: 0,
  end: count,
  count,
  clip_event_ids: [id],
  snapshot_event_id: id,
  duration_s: count,
})
function stub(payload: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(payload) }))
}
afterEach(() => vi.unstubAllGlobals())

describe('TodayRecordings', () => {
  it('renders visits and selecting one points the player at its clip', async () => {
    stub({ visits: [visit('a'), visit('b')] })
    render(<TodayRecordings />)
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2))
    fireEvent.click(screen.getAllByRole('listitem')[1])
    const video = document.querySelector('video') as HTMLVideoElement
    expect(video.getAttribute('src')).toContain('/api/cameras/clip/b')
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

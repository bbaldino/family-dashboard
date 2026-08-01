import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CentreSpreadRunningOrder } from './CentreSpreadRunningOrder'
import { MAX_RUNNING_ORDER_ROWS } from './centre-spread-capacity'

const useQueue = vi.hoisted(() => vi.fn())
vi.mock('@/data/music', () => ({ useQueue }))

const current = { title: 'Amber Hours', artist: 'The Night Shift', uri: 'fixture://track/amber-hours' }

function queueItem(i: number, overrides: Partial<{ duration: number }> = {}) {
  return {
    queue_item_id: `qi-${i}`,
    position: i,
    duration: overrides.duration,
    media_item: { name: `Track ${i}`, uri: `fixture://track/${i}`, media_type: 'track', artists: [{ name: 'The Night Shift' }] },
  }
}

describe('CentreSpreadRunningOrder', () => {
  beforeEach(() => {
    useQueue.mockReset()
  })

  it('heads the list with the current track and shows only items after it in the queue', () => {
    useQueue.mockReturnValue({
      data: [
        { queue_item_id: 'qi-0', position: 0, duration: 238, media_item: { name: 'Amber Hours', uri: current.uri, media_type: 'track', artists: [{ name: 'The Night Shift' }] } },
        queueItem(1, { duration: 201 }),
        queueItem(2, { duration: 176 }),
      ],
    })
    render(<CentreSpreadRunningOrder queueId="kitchen" current={current} />)
    expect(screen.getByText('Amber Hours')).toBeInTheDocument()
    expect(screen.getByText('now')).toBeInTheDocument()
    expect(screen.getByText('Track 1')).toBeInTheDocument()
    expect(screen.getByText('Track 2')).toBeInTheDocument()
    expect(screen.getByText('2:56')).toBeInTheDocument() // 176s formatted
  })

  it('omits the duration cell for a queue item that has none', () => {
    useQueue.mockReturnValue({ data: [queueItem(1, {})] })
    render(<CentreSpreadRunningOrder queueId="kitchen" current={{ title: 'X', artist: 'Y', uri: null }} />)
    expect(screen.getByText('Track 1')).toBeInTheDocument()
    expect(screen.queryByText(/^\d+:\d{2}$/)).not.toBeInTheDocument()
  })

  it('caps the list at MAX_RUNNING_ORDER_ROWS and names the overflow', () => {
    const items = Array.from({ length: MAX_RUNNING_ORDER_ROWS + 4 }, (_, i) => queueItem(i, { duration: 200 }))
    useQueue.mockReturnValue({ data: items })
    render(<CentreSpreadRunningOrder queueId="kitchen" current={{ title: 'X', artist: 'Y', uri: null }} />)
    // No current-item match (uri: null) means every fixture item counts as "up next".
    expect(screen.getByText(`${items.length} up next`)).toBeInTheDocument()
    expect(screen.getAllByText(/^Track \d+$/).length).toBe(MAX_RUNNING_ORDER_ROWS)
    expect(screen.getByText('+4 more')).toBeInTheDocument()
  })

  it('shows no overflow line when everything fits', () => {
    useQueue.mockReturnValue({ data: [queueItem(1, { duration: 200 })] })
    render(<CentreSpreadRunningOrder queueId="kitchen" current={{ title: 'X', artist: 'Y', uri: null }} />)
    expect(screen.queryByText(/more$/)).not.toBeInTheDocument()
  })

  it('survives an empty/undefined queue on cold start', () => {
    useQueue.mockReturnValue({ data: undefined })
    expect(() => render(<CentreSpreadRunningOrder queueId="kitchen" current={current} />)).not.toThrow()
    expect(screen.getByText('0 up next')).toBeInTheDocument()
  })
})

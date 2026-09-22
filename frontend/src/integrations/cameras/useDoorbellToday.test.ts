import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { useDoorbellToday } from './useDoorbellToday'

afterEach(() => vi.unstubAllGlobals())

describe('useDoorbellToday', () => {
  it('maps the backend visits payload to camelCase', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            visits: [
              {
                id: 'c',
                start: 5000,
                end: 5002,
                count: 1,
                clips: [{ event_id: 'c', start: 5000 }],
                snapshot_event_id: 'c',
                duration_s: 2,
              },
            ],
          }),
      }),
    )
    const { result } = renderHook(() => useDoorbellToday())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(false)
    expect(result.current.visits[0].snapshotEventId).toBe('c')
    expect(result.current.visits[0].clips).toEqual([{ eventId: 'c', start: 5000 }])
  })

  it('sets error when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }))
    const { result } = renderHook(() => useDoorbellToday())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(true)
  })
})

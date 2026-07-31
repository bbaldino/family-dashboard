import { describe, expect, it, vi, afterEach } from 'vitest'
import { fetchCalendarIds } from './config'

function mockConfigResponse(body: unknown) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch
}

describe('fetchCalendarIds', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the configured calendar ids when present', async () => {
    mockConfigResponse({
      'google-calendar.calendar_ids': JSON.stringify(['work@example.com', 'family@example.com']),
    })
    await expect(fetchCalendarIds()).resolves.toEqual(['work@example.com', 'family@example.com'])
  })

  it('falls back to primary when no calendar_ids key is saved', async () => {
    mockConfigResponse({})
    await expect(fetchCalendarIds()).resolves.toEqual(['primary'])
  })

  it('falls back to primary when the saved value is an empty array', async () => {
    mockConfigResponse({ 'google-calendar.calendar_ids': JSON.stringify([]) })
    await expect(fetchCalendarIds()).resolves.toEqual(['primary'])
  })

  it('swallows a fetch failure and falls back to primary', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch
    await expect(fetchCalendarIds()).resolves.toEqual(['primary'])
  })

  it('swallows malformed JSON in the saved value and falls back to primary', async () => {
    mockConfigResponse({ 'google-calendar.calendar_ids': 'not-json' })
    await expect(fetchCalendarIds()).resolves.toEqual(['primary'])
  })
})

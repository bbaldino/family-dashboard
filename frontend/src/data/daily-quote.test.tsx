import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useDailyQuote } from './daily-quote'

describe('useDailyQuote', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify([{ q: 'hello', a: 'someone' }]),
    })
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  )

  // Task 4's /api/fetch handler 400s on any param an endpoint doesn't declare,
  // and daily-quote/today declares none. Sending anything other than an empty
  // object here would 400 against the real backend even though this stubbed
  // test would never catch it — so pin the body shape explicitly.
  it('sends an empty params object, not an omitted or non-empty one', async () => {
    renderHook(() => useDailyQuote(), { wrapper })
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/fetch/daily-quote/today')
    expect(JSON.parse(init.body)).toEqual({ params: {} })
  })
})

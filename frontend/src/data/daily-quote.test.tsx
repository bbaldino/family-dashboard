import { describe, expect, it, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useDailyQuote } from './daily-quote'

describe('useDailyQuote', () => {
  afterEach(() => vi.unstubAllGlobals())

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  )

  it('posts the ZenQuotes URL to the proxy and reshapes the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([{ q: 'Be here now', a: 'Ram Dass' }]),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useDailyQuote(), { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data).toEqual({ quote: 'Be here now', author: 'Ram Dass' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/fetch')
    expect(JSON.parse(init.body)).toEqual({
      url: 'https://zenquotes.io/api/today',
      ttl_secs: 86400,
    })
  })

  it('throws a clear error when ZenQuotes returns an empty array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => '[]' }))

    const { result } = renderHook(() => useDailyQuote(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toMatch(/empty or malformed/)
  })
})

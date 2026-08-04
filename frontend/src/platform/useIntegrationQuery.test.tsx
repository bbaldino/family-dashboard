import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { defineIntegration, useIntegrationQuery } from './index'

const demo = defineIntegration({ id: 'daily-quote', name: 'Daily Quote' })

describe('useIntegrationQuery', () => {
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

  it('posts to the fetch capability and reshapes via select', async () => {
    const { result } = renderHook(
      () =>
        useIntegrationQuery<{ q: string; a: string }[], { quote: string }>(demo, 'today', {
          select: ([f]) => ({ quote: f.q }),
        }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.data).toEqual({ quote: 'hello' }))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/fetch/daily-quote/today')
    expect(init.method).toBe('POST')
  })

  it('sends params in the body, never in the URL', async () => {
    renderHook(() => useIntegrationQuery(demo, 'today', { params: { date: '2026-08-03' } }), {
      wrapper,
    })
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).not.toContain('2026-08-03')
    expect(JSON.parse(init.body)).toEqual({ params: { date: '2026-08-03' } })
  })
})

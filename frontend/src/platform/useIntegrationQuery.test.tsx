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

  it('gives a functional refetchInterval the select-derived shape, not the raw payload', async () => {
    const intervalFn = vi.fn().mockReturnValue(false)
    const { result } = renderHook(
      () =>
        useIntegrationQuery<{ q: string; a: string }[], { quote: string }>(demo, 'today', {
          select: ([f]) => ({ quote: f.q }),
          refetchInterval: intervalFn,
        }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.data).toEqual({ quote: 'hello' }))
    await waitFor(() => {
      const lastCall = intervalFn.mock.calls.at(-1)
      expect(lastCall?.[0]).toEqual({ quote: 'hello' })
    })
    // If the implementation ever hands the callback the raw payload instead,
    // this is what it would have seen — assert it never does.
    expect(intervalFn).not.toHaveBeenCalledWith([{ q: 'hello', a: 'someone' }])
  })

  it('does not let a throwing select escape a functional refetchInterval', async () => {
    // react-query catches a throwing `select` in the observer's derived
    // result (the query lands in status: 'error'), but the functional
    // `refetchInterval` path re-derives `select` itself outside that
    // machinery. Before the fix, a throw here propagates out of
    // QueryObserver.setOptions -> useBaseQuery as an uncaught exception —
    // on a kiosk with no error boundary, that's a wedged, blank display.
    const intervalFn = vi.fn().mockReturnValue(false)
    const { result } = renderHook(
      () =>
        useIntegrationQuery<{ q: string; a: string }[], { quote: string }>(demo, 'today', {
          select: () => {
            throw new Error('malformed payload')
          },
          refetchInterval: intervalFn,
        }),
      { wrapper },
    )

    // The hook must settle (not hang forever) and the callback must run
    // without the throw escaping the render.
    await waitFor(() => expect(result.current.status).toBe('error'))
    await waitFor(() => expect(intervalFn).toHaveBeenCalled())
    expect(intervalFn).toHaveBeenCalledWith(undefined)
  })
})

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { z } from 'zod'
import { defineIntegration, useIntegrationQuery } from './index'

const demo = defineIntegration({
  id: 'demo',
  name: 'Demo',
  schema: z.object({}),
  fields: {},
})
const DEMO_URL = 'https://zenquotes.io/api/today'

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

  it('posts the url and ttlSecs to /api/fetch and reshapes via select', async () => {
    const { result } = renderHook(
      () =>
        useIntegrationQuery<{ q: string; a: string }[], { quote: string }>(demo, DEMO_URL, {
          ttlSecs: 86400,
          select: ([f]) => ({ quote: f.q }),
        }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.data).toEqual({ quote: 'hello' }))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/fetch')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ url: DEMO_URL, ttl_secs: 86400 })
  })

  it('gives a functional refetchInterval the select-derived shape, not the raw payload', async () => {
    const intervalFn = vi.fn().mockReturnValue(false)
    const { result } = renderHook(
      () =>
        useIntegrationQuery<{ q: string; a: string }[], { quote: string }>(demo, DEMO_URL, {
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
        useIntegrationQuery<{ q: string; a: string }[], { quote: string }>(demo, DEMO_URL, {
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

  it('disables the query when url is null, and lets an explicit enabled: false win even with a url', async () => {
    const { result: waitingOnConfig } = renderHook(() => useIntegrationQuery(demo, null), {
      wrapper,
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(waitingOnConfig.current.fetchStatus).toBe('idle')

    const { result: explicitlyDisabled } = renderHook(
      () => useIntegrationQuery(demo, DEMO_URL, { enabled: false }),
      { wrapper },
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(explicitlyDisabled.current.fetchStatus).toBe('idle')
  })

  it('does not let a text and a json fetch of the same url share a cache entry', async () => {
    // Both hooks share one QueryClient on purpose — that shared cache is
    // the thing under test. `staleTime: Infinity` so a cache *hit* stays a
    // hit: with the default staleTime of 0, a second observer mounting on
    // an existing entry refetches anyway, and the call count would be 2
    // whether or not `expect` is in the key.
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    const sharedCache = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )

    const { result: asJson } = renderHook(
      () => useIntegrationQuery(demo, DEMO_URL, { expect: 'json' }),
      { wrapper: sharedCache },
    )
    await waitFor(() => expect(asJson.current.data).toBeDefined())

    const { result: asText } = renderHook(
      () => useIntegrationQuery(demo, DEMO_URL, { expect: 'text' }),
      { wrapper: sharedCache },
    )
    await waitFor(() => expect(asText.current.data).toBeDefined())

    // Two separate requests, not one entry served to both — a `text`
    // caller handed a `json` caller's parsed payload gets `{text}` where it
    // expected the upstream shape, which is a throwing `select`, not stale
    // data.
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).expect)).toEqual([
      'json',
      'text',
    ])
  })

  it('sends ttl_secs: 0 when ttlSecs is omitted', async () => {
    const { result } = renderHook(() => useIntegrationQuery(demo, DEMO_URL), { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())
    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ url: DEMO_URL, ttl_secs: 0 })
  })
})

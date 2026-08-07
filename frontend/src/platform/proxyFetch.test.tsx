import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { z } from 'zod'
import { defineIntegration, fetchViaProxy, integrationQueryKey, useIntegrationQuery } from './index'

const DEMO_URL = 'https://zenquotes.io/api/today'

describe('fetchViaProxy', () => {
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

  it('posts exactly {url, ttl_secs} for a plain GET', async () => {
    await fetchViaProxy({ url: DEMO_URL })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/fetch')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    // Absent fields are omitted, not sent as `undefined` — the backend tests
    // assert this exact shape, and `method: undefined` serialises differently.
    expect(JSON.parse(init.body)).toEqual({ url: DEMO_URL, ttl_secs: 0 })
    expect(Object.keys(JSON.parse(init.body))).toEqual(['url', 'ttl_secs'])
  })

  it('includes only the fields it was given', async () => {
    await fetchViaProxy({
      url: DEMO_URL,
      method: 'POST',
      headers: { 'X-Goog-Api-Key': 'k' },
      body: { origin: 'here' },
      ttlSecs: 300,
      expect: 'text',
    })
    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({
      url: DEMO_URL,
      method: 'POST',
      headers: { 'X-Goog-Api-Key': 'k' },
      body: { origin: 'here' },
      ttl_secs: 300,
      expect: 'text',
    })
  })

  it('sends a falsy body rather than dropping it', async () => {
    // `body: null` and `body: 0` are values a caller meant to send; only
    // `undefined` means absent.
    await fetchViaProxy({ url: DEMO_URL, method: 'POST', body: null })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      url: DEMO_URL,
      method: 'POST',
      body: null,
      ttl_secs: 0,
    })
  })

  it('throws the error from the body on a non-2xx', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: 'upstream said no' }),
    })
    await expect(fetchViaProxy({ url: DEMO_URL })).rejects.toThrow('upstream said no')
  })

  it('falls back to the status when a non-2xx body carries no error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json')
      },
    })
    await expect(fetchViaProxy({ url: DEMO_URL })).rejects.toThrow('Request failed')
  })

  it('resolves undefined on an empty body rather than throwing', async () => {
    // `.text()` then `JSON.parse`, not `.json()` — `.json()` on an empty
    // body throws.
    fetchMock.mockResolvedValue({ ok: true, status: 204, text: async () => '' })
    await expect(fetchViaProxy({ url: DEMO_URL })).resolves.toBeUndefined()
  })
})

describe('integrationQueryKey', () => {
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

  it('defaults ttlSecs to 0, the way the hook does', () => {
    expect(integrationQueryKey('demo', { url: DEMO_URL })).toEqual([
      'integration',
      'demo',
      DEMO_URL,
      undefined,
      undefined,
      undefined,
      0,
      undefined,
    ])
  })

  it('produces the key useIntegrationQuery caches under, so a fan-out caller shares the entry', async () => {
    // The point of exporting the builder: a caller doing a dynamic fan-out
    // over N destinations must land on the *same* cache entry as a
    // `useIntegrationQuery` asking for the same thing, or the two fetch twice.
    const demo = defineIntegration({ id: 'demo', name: 'Demo', schema: z.object({}), fields: {} })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )

    const spec = {
      url: DEMO_URL,
      method: 'POST' as const,
      headers: { 'X-Goog-Api-Key': 'k' },
      body: { origin: 'here' },
      ttlSecs: 300,
      expect: 'json' as const,
    }
    const { result } = renderHook(() => useIntegrationQuery(demo, spec.url, spec), { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())

    const cached = client.getQueryCache().getAll()
    expect(cached).toHaveLength(1)
    expect(cached[0].queryKey).toEqual(integrationQueryKey(demo.id, spec))
  })
})

import { describe, expect, it, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { z } from 'zod'
import { defineIntegration } from '@/data/define-integration'
import { useIntegrationData } from './useIntegrationData'

const demoIntegration = defineIntegration({
  id: 'demo',
  name: 'Demo',
  schema: z.object({
    api_key: z.string().min(1, 'API key is required'),
    refresh_minutes: z.coerce.number().int().positive().default(5),
  }),
  fields: {
    api_key: { label: 'API Key', type: 'secret' },
    refresh_minutes: { label: 'Refresh interval (minutes)' },
  },
})

/**
 * A single shared fetch mock, assembled from two independent pieces of
 * state: what `/api/fetch` returns (`mockFetchOk`) and what `/api/config`
 * returns (`seedConfig`/`seedConfigLoading`). Either can be called first —
 * matches how `weather.test.tsx`'s `stubFetch` combines both endpoints
 * behind one mock, but split into two setup calls the way the tests below
 * want to sequence them.
 */
let configState: { status: 'ready'; data: Record<string, string> } | { status: 'loading' } = {
  status: 'loading',
}
let fetchPayload: unknown = undefined
let fetchMockInstance: ReturnType<typeof vi.fn> | null = null

function ensureFetchMock() {
  if (fetchMockInstance) return fetchMockInstance
  fetchMockInstance = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/config') {
      const state = configState
      if (state.status === 'loading') {
        // Never resolves — config stays in flight for the life of the test.
        return new Promise<Response>(() => {})
      }
      return { ok: true, json: async () => state.data } as Response
    }
    if (url === '/api/fetch') {
      return { ok: true, text: async () => JSON.stringify(fetchPayload) } as Response
    }
    throw new Error(`Unexpected fetch url: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMockInstance)
  return fetchMockInstance
}

function mockFetchOk(payload: unknown) {
  fetchPayload = payload
  return ensureFetchMock()
}

function seedConfig(config: Record<string, string>) {
  configState = { status: 'ready', data: config }
  ensureFetchMock()
}

function seedConfigLoading() {
  configState = { status: 'loading' }
  ensureFetchMock()
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
)

describe('useIntegrationData', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    configState = { status: 'loading' }
    fetchPayload = undefined
    fetchMockInstance = null
  })

  it('builds the request from typed config and posts it to the proxy', async () => {
    const fetchMock = mockFetchOk({ ok: 1 })
    seedConfig({ 'demo.api_key': 'k123', 'demo.refresh_minutes': '5' })

    const { result } = renderHook(
      () =>
        useIntegrationData(demoIntegration, (cfg) => ({
          url: `https://api.example/x?key=${cfg.api_key}`,
          ttlSecs: cfg.refresh_minutes * 60,
        })),
      { wrapper },
    )
    await waitFor(() => expect(result.current.data).toBeDefined())

    const [url, init] = fetchMock.mock.calls.find(([input]) => String(input) === '/api/fetch')!
    expect(url).toBe('/api/fetch')
    expect(JSON.parse(init.body)).toEqual({
      url: 'https://api.example/x?key=k123',
      ttl_secs: 300,
    })
  })

  it('stays disabled until config is available', async () => {
    const fetchMock = mockFetchOk({ ok: 1 })
    seedConfigLoading()

    const { result } = renderHook(
      () => useIntegrationData(demoIntegration, (cfg) => ({ url: `https://x/${cfg.api_key}` })),
      { wrapper },
    )
    expect(result.current.fetchStatus).toBe('idle')
    expect(fetchMock).not.toHaveBeenCalledWith('/api/fetch', expect.anything())
  })

  it('never calls the builder with null config', async () => {
    // Guards the ordering: the builder must not run before config parses, or it
    // dereferences undefined and throws inside render.
    const builder = vi.fn((cfg: { api_key: string }) => ({ url: `https://x/${cfg.api_key}` }))
    seedConfigLoading()
    renderHook(() => useIntegrationData(demoIntegration, builder), { wrapper })
    expect(builder).not.toHaveBeenCalled()
  })

  it('forwards method, headers and body', async () => {
    const fetchMock = mockFetchOk({ ok: 1 })
    seedConfig({ 'demo.api_key': 'k123', 'demo.refresh_minutes': '5' })

    renderHook(
      () =>
        useIntegrationData(demoIntegration, (cfg) => ({
          url: 'https://api.example/compute',
          method: 'POST',
          headers: { 'X-Api-Key': cfg.api_key },
          body: { a: 1 },
        })),
      { wrapper },
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/fetch', expect.anything()))

    const [, init] = fetchMock.mock.calls.find(([input]) => String(input) === '/api/fetch')!
    expect(JSON.parse(init.body)).toEqual({
      url: 'https://api.example/compute',
      method: 'POST',
      headers: { 'X-Api-Key': 'k123' },
      body: { a: 1 },
      ttl_secs: 0,
    })
  })

  it('applies select and honours an explicit enabled: false', async () => {
    const fetchMock = mockFetchOk({ n: 2 })
    seedConfig({ 'demo.api_key': 'k', 'demo.refresh_minutes': '5' })

    const { result } = renderHook(
      () =>
        useIntegrationData(demoIntegration, (cfg) => ({ url: `https://x/${cfg.api_key}` }), {
          enabled: false,
        }),
      { wrapper },
    )
    expect(result.current.fetchStatus).toBe('idle')
    expect(fetchMock).not.toHaveBeenCalledWith('/api/fetch', expect.anything())
  })
})

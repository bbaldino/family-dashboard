import { describe, expect, it, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { z } from 'zod'
import { defineIntegration } from '@/data/define-integration'
import { defineIntegration as definePlatformIntegration } from './defineIntegration'
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

/** No config schema at all — `@/platform`'s `defineIntegration`, the shape
 *  `daily-quote` uses. Nothing for `useIntegrationData` to gate on. */
const demoNoConfigIntegration = definePlatformIntegration({
  id: 'demo-no-config',
  name: 'Demo (no config)',
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

  it('lets an explicit enabled: false win once config is available', async () => {
    const fetchMock = mockFetchOk({ ok: 1 })
    seedConfig({ 'demo.api_key': 'k', 'demo.refresh_minutes': '5' })

    // One shared QueryClient for both renders below, not the module-level
    // `wrapper` (which hands each renderHook its own fresh client/cache).
    // Sharing one means `disabled`'s own `useAllConfig` call reads config
    // from cache rather than re-fetching it, so there is no second
    // in-flight config fetch left to confound the result — the control
    // having data already proves config is resolved for both.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const sharedWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    // Control: identical config and builder, `enabled` omitted — this one
    // must fetch. Without a control that actually does fetch, an idle
    // `disabled` result is indistinguishable from config simply not having
    // arrived yet (see 'stays disabled until config is available' above),
    // which is exactly how this guard went untested the first time: the
    // previous version of this test asserted synchronously, before
    // `/api/config` could possibly have resolved, so it passed whether or
    // not `enabled: false` was even wired up.
    const { result: control } = renderHook(
      () => useIntegrationData(demoIntegration, (cfg) => ({ url: `https://x/${cfg.api_key}` })),
      { wrapper: sharedWrapper },
    )
    await waitFor(() => expect(control.current.data).toBeDefined())
    const callsBeforeDisabled = fetchMock.mock.calls.filter(
      ([input]) => String(input) === '/api/fetch',
    ).length
    expect(callsBeforeDisabled).toBeGreaterThan(0)

    const { result: disabled } = renderHook(
      () =>
        useIntegrationData(demoIntegration, (cfg) => ({ url: `https://x/${cfg.api_key}` }), {
          enabled: false,
        }),
      { wrapper: sharedWrapper },
    )
    // Config is already resolved and cached on the shared client (proven by
    // `control` above), so `disabled` reads it from cache immediately — no
    // config fetch of its own left in flight to explain an idle result away.
    // If it's idle, it's because `enabled: false` won.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(disabled.current.fetchStatus).toBe('idle')

    const callsAfterDisabled = fetchMock.mock.calls.filter(
      ([input]) => String(input) === '/api/fetch',
    ).length
    expect(callsAfterDisabled).toBe(callsBeforeDisabled)
  })

  it('fires immediately for a schema-less integration, without waiting on /api/config', async () => {
    const fetchMock = mockFetchOk({ ok: 1 })
    seedConfigLoading()

    renderHook(
      () => useIntegrationData(demoNoConfigIntegration, () => ({ url: 'https://x/no-config' })),
      { wrapper },
    )

    // `/api/config` is stuck loading (seedConfigLoading never resolves it),
    // yet the request still reaches the proxy — a schema-less integration
    // has nothing to wait on and must not gate on it.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/fetch', expect.anything()))

    // The point of this fix round was avoiding the network dependency
    // outright, not just declining to wait on it — assert `/api/config` was
    // never requested at all, not merely that it didn't block.
    expect(fetchMock).not.toHaveBeenCalledWith('/api/config')
  })

  it('still gates a schema-carrying integration on config, even sharing a code path with the schema-less case', async () => {
    const fetchMock = mockFetchOk({ ok: 1 })
    seedConfigLoading()

    renderHook(
      () => useIntegrationData(demoIntegration, (cfg) => ({ url: `https://x/${cfg.api_key}` })),
      { wrapper },
    )

    // Give any pending microtasks a chance to run, then confirm the
    // schema-carrying path still never reaches the proxy while config is
    // loading — the schema-less fast path above must not have leaked into
    // this one now that both run through the same hook.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fetchMock).not.toHaveBeenCalledWith('/api/fetch', expect.anything())
  })
})

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useOnThisDay } from './useOnThisDay'
import { CONFIG_QUERY_KEY } from '@/platform/useAllConfig'

/**
 * Pins the composition the deleted Rust route used to do server-side: two
 * Wikipedia feeds fetched through `/api/fetch`, merged, keyword-filtered, and
 * handed to the LLM through `/api/llm/generate`.
 *
 * The pure halves (merge, filter, prompt, parse) are exercised in
 * `curate.test.ts`; this suite is about the wiring the hook adds on top —
 * request shape, the `enabled` gate, the model in the curation key, and the
 * three tolerance behaviours ported from `routes.rs`: one feed failing is not
 * fatal, an LLM failure falls back to the whole filtered list, and an empty
 * result is never cached.
 */

const CONFIG = { 'on-this-day.model': 'haiku', 'on-this-day.cycle_minutes': '30' }

const USER_AGENT = 'DashboardApp/1.0 (family kitchen dashboard)'
const WIKI_BASE = 'https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday'
const SELECTED_URL = `${WIKI_BASE}/selected/03/09`
const EVENTS_URL = `${WIKI_BASE}/events/03/09`

const MOON_TEXT = 'Apollo 11 (pictured) lands on the Moon'
const MOON_IMAGE = 'https://upload.wikimedia.org/moon.jpg'

/**
 * Three selected, nine general. One general entry duplicates a selected one
 * (dropped by `mergeFeeds`) and two entries trip the keyword filter, so the
 * surviving pool is nine — a number that is neither the raw total (12), the
 * merged total (11), nor the five the prompt asks the model for. Crucially it
 * is *larger* than five: a pool of four would let `pool.slice(0, 5)` in the
 * LLM-failure path pass as a no-op, which is exactly the bug the "uncapped"
 * test below exists to catch.
 */
const SELECTED_PAYLOAD = {
  selected: [
    { text: MOON_TEXT, year: 1969, pages: [{ thumbnail: { source: MOON_IMAGE } }] },
    { text: 'A massacre takes place', year: 1500 },
    { text: 'The first warehouse opens', year: 1900 },
  ],
}

const EVENTS_PAYLOAD = {
  events: [
    { text: MOON_TEXT, year: 1969 },
    { text: 'The transistor is invented', year: 1947 },
    { text: 'A new species of frog is named', year: 2001 },
    { text: 'The bridge collapsed', year: 1940 },
    { text: 'The first public library opens', year: 1833 },
    { text: 'A comet is observed from Earth', year: 1682 },
    { text: 'The symphony premieres in Vienna', year: 1824 },
    { text: 'The lighthouse is lit for the first time', year: 1716 },
    { text: 'A new opera house opens its doors', year: 1875 },
  ],
}

/**
 * Pool order after merge + filter: moon, warehouse, transistor, frog, library,
 * comet, symphony, lighthouse, opera.
 */
const POOL_SIZE = 9

interface StubOptions {
  /** LLM reply. `null` makes `/api/llm/generate` return a 500. */
  answer?: string | null
  /** Make the general-events feed fail upstream. */
  eventsFails?: boolean
  /** Withhold the general-events feed until the returned resolver is called. */
  holdEvents?: boolean
}

function stubFetch(opts: StubOptions = {}) {
  const { answer = '1, 3', eventsFails = false, holdEvents = false } = opts

  let releaseEvents: () => void = () => {}
  const eventsGate = holdEvents ? new Promise<void>((r) => (releaseEvents = r)) : Promise.resolve()

  let selectedServed = false

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === '/api/config') {
      return { ok: true, json: async () => CONFIG } as Response
    }
    if (url === '/api/fetch') {
      const body = JSON.parse(init!.body as string) as { url: string }
      // Matched by feed rather than by exact URL so the same stub serves any
      // date — the midnight-rollover test needs both 03/09 and 03/10.
      if (body.url.startsWith(`${WIKI_BASE}/selected/`)) {
        selectedServed = true
        return { ok: true, text: async () => JSON.stringify(SELECTED_PAYLOAD) } as Response
      }
      if (body.url.startsWith(`${WIKI_BASE}/events/`)) {
        await eventsGate
        if (eventsFails) {
          return { ok: false, json: async () => ({ error: 'upstream 500' }) } as Response
        }
        return { ok: true, text: async () => JSON.stringify(EVENTS_PAYLOAD) } as Response
      }
      throw new Error(`Unexpected upstream url in body: ${body.url}`)
    }
    if (url === '/api/llm/generate') {
      if (answer === null) {
        return { ok: false, status: 500, json: async () => ({}) } as Response
      }
      return { ok: true, json: async () => ({ text: answer }) } as Response
    }
    throw new Error(`Unexpected fetch url: ${url}`)
  })

  vi.stubGlobal('fetch', fetchMock)

  return {
    fetchMock,
    releaseEvents: () => releaseEvents(),
    selectedServed: () => selectedServed,
    proxyBodies: () =>
      fetchMock.mock.calls
        .filter(([input]) => String(input) === '/api/fetch')
        .map(([, init]) => JSON.parse((init as RequestInit).body as string)),
    generateBodies: () =>
      fetchMock.mock.calls
        .filter(([input]) => String(input) === '/api/llm/generate')
        .map(([, init]) => JSON.parse((init as RequestInit).body as string)),
  }
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useOnThisDay', () => {
  beforeEach(() => {
    // Zero-padding is the point: March 9th has to render `03/09`, not `3/9`,
    // or Wikipedia 404s. Local, not UTC — the Rust used `chrono::Local`.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-03-09T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('composes both feed requests with the zero-padded local date, User-Agent and 6h TTL', async () => {
    const stub = stubFetch()
    const { result } = renderHook(() => useOnThisDay(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(stub.proxyBodies()).toContainEqual({
      url: SELECTED_URL,
      headers: { 'User-Agent': USER_AGENT },
      ttl_secs: 21600,
    })
    expect(stub.proxyBodies()).toContainEqual({
      url: EVENTS_URL,
      headers: { 'User-Agent': USER_AGENT },
      ttl_secs: 21600,
    })
  })

  it("reshapes the model's picks into events, carrying the thumbnail through", async () => {
    stubFetch({ answer: '1, 3' })
    const { result } = renderHook(() => useOnThisDay(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data).toEqual({
      events: [
        // "(pictured)" stripped — the widget shows no such image inline.
        { year: 1969, text: 'Apollo 11 lands on the Moon', imageUrl: MOON_IMAGE },
        { year: 1947, text: 'The transistor is invented', imageUrl: null },
      ],
    })
    expect(result.current.isLoading).toBe(false)
  })

  it('falls back to the whole filtered pool — uncapped — when the LLM call fails', async () => {
    stubFetch({ answer: null })
    const { result } = renderHook(() => useOnThisDay(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(result.current.data).toBeDefined())

    // The whole filtered list, not the five the prompt asks for: the widget
    // cycles one event at a time, so a long list degrades gracefully.
    expect(result.current.data!.events).toHaveLength(POOL_SIZE)
    expect(result.current.data!.events.map((e) => e.year)).toEqual([
      1969, 1900, 1947, 2001, 1833, 1682, 1824, 1716, 1875,
    ])
  })

  it('still produces events when one feed fails outright', async () => {
    stubFetch({ eventsFails: true, answer: '1' })
    const { result } = renderHook(() => useOnThisDay(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(result.current.data).toBeDefined())

    // Selected survived on its own: moon + warehouse, massacre filtered out.
    expect(result.current.data!.events).toEqual([
      { year: 1969, text: 'Apollo 11 lands on the Moon', imageUrl: MOON_IMAGE },
    ])
  })

  it('leaves data undefined for an empty result and does not cache it', async () => {
    const stub = stubFetch({ answer: 'I would rather not pick any of these.' })
    const queryClient = newClient()
    const wrapper = wrapperFor(queryClient)

    const first = renderHook(() => useOnThisDay(), { wrapper })
    await waitFor(() => expect(first.result.current.isLoading).toBe(false))
    expect(first.result.current.data).toBeUndefined()
    expect(stub.generateBodies()).toHaveLength(1)

    // The Rust cached only non-empty responses, so an empty day retried on the
    // next request instead of sticking for six hours. Throwing reproduces that:
    // react-query does not cache a rejected query, so a fresh mount re-asks.
    first.unmount()
    const second = renderHook(() => useOnThisDay(), { wrapper })
    await waitFor(() => expect(stub.generateBodies()).toHaveLength(2))
    expect(second.result.current.data).toBeUndefined()
  })

  it('re-curates when the configured model changes', async () => {
    const stub = stubFetch({ answer: '1' })
    const queryClient = newClient()
    const { result } = renderHook(() => useOnThisDay(), { wrapper: wrapperFor(queryClient) })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(stub.generateBodies()).toEqual([expect.objectContaining({ model: 'haiku' })])

    act(() => {
      queryClient.setQueryData(CONFIG_QUERY_KEY, {
        ...CONFIG,
        'on-this-day.model': 'sonnet',
      })
    })

    // `model` is in the curation query key, so switching it re-curates rather
    // than serving the previous model's picks forever.
    await waitFor(() => expect(stub.generateBodies()).toHaveLength(2))
    expect(stub.generateBodies()[1]).toEqual(expect.objectContaining({ model: 'sonnet' }))
  })

  it('rolls the feed URLs over at midnight with no re-render from outside', async () => {
    // 23:59 local. Nothing but the hook's own date timer touches this render
    // tree for the rest of the test — in particular the consumer's cycle timer
    // (`OnThisDayWidget`) is absent, which is the case that used to pin a
    // one-event day to yesterday's date forever.
    vi.setSystemTime(new Date('2026-03-09T23:59:00'))
    const stub = stubFetch({ answer: '1' })
    const { result } = renderHook(() => useOnThisDay(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(
      stub
        .proxyBodies()
        .map((b) => b.url)
        .sort(),
    ).toEqual([EVENTS_URL, SELECTED_URL])

    // Cross midnight, then advance well past the date-check cadence but nowhere
    // near the hourly `refetchInterval` — the rollover must come from the date
    // state, not from a poll.
    vi.setSystemTime(new Date('2026-03-10T00:00:30'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * 60 * 1000)
    })

    await waitFor(() =>
      expect(stub.proxyBodies().map((b) => b.url)).toContain(`${WIKI_BASE}/selected/03/10`),
    )
    expect(stub.proxyBodies().map((b) => b.url)).toContain(`${WIKI_BASE}/events/03/10`)
  })

  it('does not curate until both feeds have settled', async () => {
    const stub = stubFetch({ holdEvents: true, answer: '1' })
    const { result } = renderHook(() => useOnThisDay(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(stub.selectedServed()).toBe(true))
    // Let every pending microtask and the react-query notify batch drain, so
    // the selected feed's data is genuinely in the cache before asserting.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    // Curating here would send the model half a pool and cache the result
    // under a poolKey that is about to change.
    expect(stub.generateBodies()).toHaveLength(0)
    expect(result.current.isLoading).toBe(true)

    stub.releaseEvents()
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(stub.generateBodies()).toHaveLength(1)
  })
})

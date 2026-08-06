import { describe, expect, it, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useWordOfTheDay } from './useWordOfTheDay'
import feedXml from './fixtures/wotd-feed.xml?raw'

/**
 * `word-of-the-day` is config-less (`schema: z.object({})`), so this only
 * needs to stub `/api/fetch` — `useIntegrationData`'s config-less fast path
 * never touches `/api/config` (see `useIntegrationData.test.tsx`).
 */
function stubFetch(text: string) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    // `init` isn't read here — the request-shape test inspects it directly
    // off `fetchMock.mock.calls`, which is why it stays in the signature
    // (so the mock's call tuples type as `[input, init]` instead of
    // `[input]`).
    void init
    const url = String(input)
    if (url === '/api/fetch') {
      return { ok: true, text: async () => JSON.stringify({ text }) } as Response
    }
    throw new Error(`Unexpected fetch url: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useWordOfTheDay', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('composes the /api/fetch request: url, User-Agent header, expect: text, and ttlSecs', async () => {
    const fetchMock = stubFetch(feedXml)

    renderHook(() => useWordOfTheDay(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => String(input) === '/api/fetch')).toBe(true)
    })

    const [, init] = fetchMock.mock.calls.find(([input]) => String(input) === '/api/fetch')!
    const body = JSON.parse((init as RequestInit).body as string)

    expect(body).toEqual({
      url: 'https://www.merriam-webster.com/wotd/feed/rss2',
      headers: { 'User-Agent': 'DashboardApp/1.0 (family kitchen dashboard)' },
      expect: 'text',
      ttl_secs: 3600,
    })
  })

  it('resolves the parsed word from a real captured feed response', async () => {
    stubFetch(feedXml)

    const { result } = renderHook(() => useWordOfTheDay(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.data).toBeDefined())

    // The fixture's newest item (torpor) is what any "today" at or after
    // 2026-08-06 resolves to via the fallback-to-newest rule — the point
    // here is that the full pipeline (fetch -> text -> select -> parse)
    // produces a real word, not a specific date's word.
    expect(result.current.data?.word).toBeTruthy()
    expect(result.current.data?.definition).toBeTruthy()
  })

  it('lands in an error state, not a blank word, when the feed has no items', async () => {
    const emptyFeed = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0"><channel><title>Empty</title></channel></rss>`
    stubFetch(emptyFeed)

    const { result } = renderHook(() => useWordOfTheDay(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })
})

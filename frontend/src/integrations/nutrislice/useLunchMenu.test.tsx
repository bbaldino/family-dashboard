import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useLunchMenu } from './useLunchMenu'

/**
 * Pins the two upstream request bodies `useLunchMenu` composes (this week +
 * next week) against a known district/school/menu-type/date — in
 * particular that the `date` path segment goes in raw, slashes and all,
 * rather than `encodeURIComponent`'d as a whole (which would turn it into
 * `%2F`-separated garbage and 404 against NutriSlice). The domain reshaping
 * (`parseDayMenu`, "w/" sides, "OR" alternatives) is exercised separately —
 * this suite only pins the request shape and the today/tomorrow/week
 * selection over two combined weeks.
 */

const FULL_CONFIG = {
  'nutrislice.school': 'bagby-elementary-school',
  'nutrislice.district': 'cambriansd',
  'nutrislice.menu_type': 'lunch',
}

const THIS_WEEK_URL =
  'https://cambriansd.api.nutrislice.com/menu/api/weeks/school/bagby-elementary-school/menu-type/lunch/2026/08/05?format=json'
const NEXT_WEEK_URL =
  'https://cambriansd.api.nutrislice.com/menu/api/weeks/school/bagby-elementary-school/menu-type/lunch/2026/08/10?format=json'

const THIS_WEEK_PAYLOAD = {
  days: [
    {
      date: '2026-08-05',
      menu_items: [{ text: 'Pizza', position: 1 }],
    },
  ],
}
const NEXT_WEEK_PAYLOAD = { days: [] }

function stubFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === '/api/config') {
      return { ok: true, json: async () => FULL_CONFIG } as Response
    }
    if (url === '/api/fetch') {
      const body = JSON.parse(init!.body as string) as { url: string; ttl_secs: number }
      let payload: unknown
      if (body.url === THIS_WEEK_URL) {
        payload = THIS_WEEK_PAYLOAD
      } else if (body.url === NEXT_WEEK_URL) {
        payload = NEXT_WEEK_PAYLOAD
      } else {
        throw new Error(`Unexpected upstream url in body: ${body.url}`)
      }
      return { ok: true, text: async () => JSON.stringify(payload) } as Response
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

describe('nutrislice URL construction', () => {
  beforeEach(() => {
    // 2026-08-05 is a Wednesday; next Monday is 2026-08-10 — pins the
    // `nextMonday` computation alongside the URL.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('composes this-week and next-week requests with the raw YYYY/MM/DD path segment and ttlSecs', async () => {
    const fetchMock = stubFetch()
    const { result } = renderHook(() => useLunchMenu(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).not.toBeNull())

    const calls = fetchMock.mock.calls.filter(([input]) => String(input) === '/api/fetch')
    const bodies = calls.map(([, init]) => JSON.parse((init as RequestInit).body as string))

    expect(bodies).toContainEqual({ url: THIS_WEEK_URL, ttl_secs: 3600 })
    expect(bodies).toContainEqual({ url: NEXT_WEEK_URL, ttl_secs: 3600 })
  })

  it('derives today from this week and returns null until both weeks have loaded', async () => {
    stubFetch()
    const { result } = renderHook(() => useLunchMenu(), { wrapper: createWrapper() })

    // Cold cache: null, not undefined — HouseholdColumn relies on this.
    expect(result.current.data).toBeNull()

    await waitFor(() => expect(result.current.data).not.toBeNull())
    expect(result.current.data!.today).toEqual({
      date: '2026-08-05',
      dayName: 'Wednesday',
      entries: [{ name: 'Pizza', withItems: [], isAlternative: false }],
      extras: [],
    })
  })
})

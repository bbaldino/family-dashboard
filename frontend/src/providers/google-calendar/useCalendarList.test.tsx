import { describe, expect, it, vi, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCalendarList } from './useCalendarList'
import type { CalendarListEntry } from './types'

/**
 * Pins two things: the composed request (`GET /api/google-calendar/calendars`,
 * unwrapped to the raw list `defineIntegration`'s `api.get` already parses),
 * and the on-demand trigger — `GoogleCalendarSettings` fetches this from a
 * button, not on mount, so the hook must not fire on its own.
 */

const CALENDARS: CalendarListEntry[] = [
  { id: 'primary', summary: 'Family', primary: true },
  { id: 'work@group.calendar.google.com', summary: 'Work' },
]

function mockFetch(calendars: CalendarListEntry[] | { error: string }, ok = true) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/google-calendar/calendars') {
      return Promise.resolve({
        ok,
        status: ok ? 200 : 500,
        json: () => Promise.resolve(calendars),
        text: () => Promise.resolve(JSON.stringify(calendars)),
      } as Response)
    }
    return Promise.reject(new Error(`Unexpected fetch url: ${url}`))
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useCalendarList', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not fetch until triggered', async () => {
    const fetchMock = mockFetch(CALENDARS)

    const { result } = renderHook(() => useCalendarList(), { wrapper: createWrapper() })

    // Let any microtasks that would fire an unwanted mount-time request drain.
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.data).toBeUndefined()
    expect(result.current.isFetching).toBe(false)
  })

  it('fetches /api/google-calendar/calendars and returns the parsed list once triggered', async () => {
    const fetchMock = mockFetch(CALENDARS)

    const { result } = renderHook(() => useCalendarList(), { wrapper: createWrapper() })

    result.current.refetch()

    await waitFor(() => expect(result.current.data).toEqual(CALENDARS))
    expect(fetchMock).toHaveBeenCalledWith('/api/google-calendar/calendars', undefined)
  })

  it('surfaces a failed fetch as an error rather than silently returning nothing', async () => {
    mockFetch({ error: 'upstream failed' }, false)

    const { result } = renderHook(() => useCalendarList(), { wrapper: createWrapper() })

    result.current.refetch()

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(Error)
    expect((result.current.error as Error).message).toBe('upstream failed')
  })
})

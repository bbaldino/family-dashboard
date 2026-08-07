import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CalendarEvent } from '@/providers/google-calendar'

// This file tests the *wiring* between the calendar hooks and the scenario
// fixtures — that a defined fixture short-circuits the fetch, and an
// undefined one (no scenario, or a scenario this integration doesn't
// define) falls through to the normal fetch path unchanged. The fixture
// content itself is covered by fixtures.test.ts; mocking './fixtures' here
// lets each case be set up directly without depending on `?scenario=`.
const { monthFixtureFor, weekFixtureFor } = vi.hoisted(() => ({
  monthFixtureFor: vi.fn(),
  weekFixtureFor: vi.fn(),
}))

vi.mock('./fixtures', () => ({ monthFixtureFor, weekFixtureFor }))

import { useMonthCalendar } from './useMonthCalendar'
import { useGoogleCalendar } from './useGoogleCalendar'

function mockFetch(events: CalendarEvent[]) {
  globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/config') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response)
    }
    if (url.startsWith('/api/google-calendar/events')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(events)),
      } as Response)
    }
    return Promise.reject(new Error(`Unexpected fetch url: ${url}`))
  }) as unknown as typeof fetch
}

/**
 * Serves `/api/config` (both hooks wait for it before deciding anything) and
 * records everything else, so a fixture case can assert that no *calendar*
 * request went out — the config read is not the thing a fixture replaces.
 */
function mockConfigOnlyFetch() {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    if (String(input) === '/api/config') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response)
    }
    return Promise.reject(new Error(`Unexpected fetch url: ${String(input)}`))
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

function eventRequests(fetchMock: ReturnType<typeof mockConfigOnlyFetch>): string[] {
  return fetchMock.mock.calls
    .map((call) => String(call[0]))
    .filter((url) => url.startsWith('/api/google-calendar/'))
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('calendar hook scenario wiring', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    monthFixtureFor.mockReset()
    weekFixtureFor.mockReset()
  })

  it('useMonthCalendar returns the fixture without touching fetch when one is defined', async () => {
    const fixture = { byDate: { '2026-05-15': [] } }
    monthFixtureFor.mockReturnValue(fixture)
    const fetchMock = mockConfigOnlyFetch()

    const { result } = renderHook(() => useMonthCalendar(2026, 4), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).not.toBeNull())

    expect(result.current.data).toEqual(fixture)
    expect(eventRequests(fetchMock)).toEqual([])
  })

  it('useMonthCalendar fetches normally when no fixture is defined for the active scenario', async () => {
    monthFixtureFor.mockReturnValue(undefined)
    const event: CalendarEvent = {
      id: 'e1',
      summary: 'Test event',
      start: { date: '2026-05-15' },
      end: { date: '2026-05-16' },
    }
    mockFetch([event])

    const { result } = renderHook(() => useMonthCalendar(2026, 4), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).not.toBeNull())

    expect(result.current.data?.byDate['2026-05-15']?.[0]?.id).toBe('e1')
  })

  it('useGoogleCalendar returns the fixture without touching fetch when one is defined', async () => {
    const fixture = [
      { date: new Date(2026, 4, 15), label: 'Today 5/15', isToday: true, events: [] },
    ]
    weekFixtureFor.mockReturnValue(fixture)
    const fetchMock = mockConfigOnlyFetch()

    const { result } = renderHook(() => useGoogleCalendar(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).not.toBeNull())

    expect(result.current.data).toEqual(fixture)
    expect(eventRequests(fetchMock)).toEqual([])
  })

  it('useGoogleCalendar fetches normally when no fixture is defined for the active scenario', async () => {
    weekFixtureFor.mockReturnValue(undefined)
    mockFetch([])

    const { result } = renderHook(() => useGoogleCalendar(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).not.toBeNull())

    expect(result.current.data).toHaveLength(7)
  })
})

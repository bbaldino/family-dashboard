import { describe, expect, it, vi, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMonthCalendar } from './useMonthCalendar'
import type { CalendarEvent } from './types'

// Timezone is pinned to America/Los_Angeles in vite.config.ts's test.env, so
// the -07:00 offsets below bucket unambiguously (see eventLocalDateStr).

function mockFetch(events: CalendarEvent[]) {
  globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/config') {
      // No configured calendar_ids -> fetchCalendarIds falls back to ['primary'].
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

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

async function renderMonthCalendar(year: number, month: number) {
  const { result } = renderHook(() => useMonthCalendar(year, month), {
    wrapper: createWrapper(),
  })
  await waitFor(() => expect(result.current.data).not.toBeNull())
  return result.current.data!
}

describe('useMonthCalendar', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('expands a multi-day all-day event across every day it spans, using an exclusive end date', async () => {
    // Google Calendar's all-day end date is exclusive: start 05-10 / end 05-13
    // spans the 10th, 11th and 12th but not the 13th.
    const trip: CalendarEvent = {
      id: 'trip',
      summary: 'Family trip',
      start: { date: '2026-05-10' },
      end: { date: '2026-05-13' },
    }
    mockFetch([trip])

    const { byDate } = await renderMonthCalendar(2026, 4)

    expect(byDate['2026-05-10']?.map((e) => e.id)).toEqual(['trip'])
    expect(byDate['2026-05-11']?.map((e) => e.id)).toEqual(['trip'])
    expect(byDate['2026-05-12']?.map((e) => e.id)).toEqual(['trip'])
    expect(byDate['2026-05-13']).toBeUndefined()
  })

  it('buckets a single-day timed event under its own local date only', async () => {
    const lunch: CalendarEvent = {
      id: 'lunch',
      summary: 'Lunch',
      start: { dateTime: '2026-05-15T12:00:00-07:00' },
      end: { dateTime: '2026-05-15T13:00:00-07:00' },
    }
    mockFetch([lunch])

    const { byDate } = await renderMonthCalendar(2026, 4)

    expect(byDate['2026-05-15']?.map((e) => e.id)).toEqual(['lunch'])
    expect(Object.keys(byDate)).toEqual(['2026-05-15'])
  })

  it('sorts each day with all-day events first, then timed events chronologically', async () => {
    const earlyMeeting: CalendarEvent = {
      id: 'early-meeting',
      summary: 'Early meeting',
      start: { dateTime: '2026-05-15T09:00:00-07:00' },
      end: { dateTime: '2026-05-15T09:30:00-07:00' },
    }
    const lateMeeting: CalendarEvent = {
      id: 'late-meeting',
      summary: 'Late meeting',
      start: { dateTime: '2026-05-15T14:00:00-07:00' },
      end: { dateTime: '2026-05-15T14:30:00-07:00' },
    }
    const holiday: CalendarEvent = {
      id: 'holiday',
      summary: 'Holiday',
      start: { date: '2026-05-15' },
      end: { date: '2026-05-16' },
    }
    // Deliberately out of order in the source data.
    mockFetch([lateMeeting, earlyMeeting, holiday])

    const { byDate } = await renderMonthCalendar(2026, 4)

    expect(byDate['2026-05-15']?.map((e) => e.id)).toEqual([
      'holiday',
      'early-meeting',
      'late-meeting',
    ])
  })
})

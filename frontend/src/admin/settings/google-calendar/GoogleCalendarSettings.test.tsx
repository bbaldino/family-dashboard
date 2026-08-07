import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GoogleCalendarSettings } from './GoogleCalendarSettings'
import { CONFIG_QUERY_KEY, useAllConfig } from '@/platform'

/**
 * The one-shot prefill. This form reads the shared `/api/config` query once,
 * at mount, and ignores every later value — because unsaved edits live only
 * in its own state and are never in `/api/config`, so a form that tracked
 * the query would throw away whatever someone had ticked on the next poll
 * tick, with nobody else having changed a thing.
 */

const CALENDARS = [
  { id: 'work', summary: 'Work', primary: true },
  { id: 'home', summary: 'Home' },
  { id: 'school', summary: 'School' },
]

function stubFetch(calendarIds: string[] | undefined) {
  let stored = calendarIds === undefined ? undefined : JSON.stringify(calendarIds)
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === '/api/config') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(stored === undefined ? {} : { 'calendar.calendar_ids': stored }),
      } as Response)
    }
    if (url === '/api/google-calendar/calendars') {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(CALENDARS)),
      } as Response)
    }
    if (url === '/api/config/calendar.calendar_ids' && init?.method === 'PUT') {
      const body = JSON.parse(String(init.body)) as { value: string }
      stored = body.value
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response)
    }
    return Promise.reject(new Error(`Unexpected fetch url: ${url}`))
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, setStored: (value: string) => (stored = value) }
}

/** A second consumer of the shared query, so a test can tell when a refresh
 *  has actually reached the components rather than just the cache. */
function Probe() {
  const { data } = useAllConfig()
  return <div data-testid="probe">{data?.['calendar.calendar_ids'] ?? ''}</div>
}

describe('GoogleCalendarSettings', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not overwrite an in-progress selection when the config query refreshes', async () => {
    const { setStored } = stubFetch(['work'])
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        {/* The probe is the synchronisation point: react-query notifies its
         *  observers a tick after the refetch resolves, so asserting straight
         *  after `invalidateQueries` would pass before the new config had
         *  reached any component at all — and would go on passing against a
         *  form that re-seeded itself on every poll. */}
        <Probe />
        <GoogleCalendarSettings />
      </QueryClientProvider>,
    )
    // The list is only fetched on demand, so the checkboxes need a click first.
    fireEvent.click(await screen.findByRole('button', { name: 'Fetch Calendars' }))
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /Work/ })).toBeChecked())

    // Ticked but not saved yet.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Home' }))
    expect(screen.getByRole('checkbox', { name: 'Home' })).toBeChecked()

    // A poll lands, carrying an outright change made elsewhere. It may not
    // reach into a selection someone is in the middle of making.
    setStored(JSON.stringify(['school']))
    await act(async () => {
      await client.invalidateQueries({ queryKey: CONFIG_QUERY_KEY })
    })
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('school'))

    expect(screen.getByRole('checkbox', { name: 'Home' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Work/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'School' })).not.toBeChecked()
  })

  it('saves only the ticked calendar from an unconfigured panel, not a primary default', async () => {
    // `calendar.calendar_ids` absent entirely — an unconfigured install. The
    // panel is an edit surface: it must seed from what is actually stored
    // ([], here), never from the `'primary'` fallback that fetch paths use.
    // Otherwise `'primary'` rides along in the save with no checkbox to
    // untick it by — Google never returns that literal string as a real
    // calendar id.
    const { fetchMock } = stubFetch(undefined)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <GoogleCalendarSettings />
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Fetch Calendars' }))
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /Work/ })).toBeInTheDocument())

    expect(screen.getByRole('checkbox', { name: /Work/ })).not.toBeChecked()

    fireEvent.click(screen.getByRole('checkbox', { name: /Work/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/config/calendar.calendar_ids',
        expect.objectContaining({ method: 'PUT' }),
      ),
    )
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/config/calendar.calendar_ids')
    const body = JSON.parse(String(call?.[1]?.body)) as { value: string }
    expect(JSON.parse(body.value)).toEqual(['work'])
  })
})

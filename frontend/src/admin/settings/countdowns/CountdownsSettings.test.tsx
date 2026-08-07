import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CountdownsSettings } from './CountdownsSettings'
import { CONFIG_QUERY_KEY, useAllConfig } from '@/platform'

/**
 * The one-shot prefill. This form reads the shared `/api/config` query once,
 * at mount, and ignores every later value — because unsaved edits live only
 * in its own state and are never in `/api/config`, so a form that tracked
 * the query would throw away whatever someone had typed on the next poll
 * tick, with nobody else having changed a thing.
 */

const CALENDARS = [
  { id: 'family', summary: 'Family', primary: true },
  { id: 'work', summary: 'Work' },
]

function stubFetch(config: Record<string, string>) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/config') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(config) } as Response)
    }
    if (url === '/api/google-calendar/calendars') {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(CALENDARS)),
      } as Response)
    }
    return Promise.reject(new Error(`Unexpected fetch url: ${url}`))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** A second consumer of the shared query, so a test can tell when a refresh
 *  has actually reached the components rather than just the cache. */
function Probe() {
  const { data } = useAllConfig()
  return <div data-testid="probe">{data?.['countdowns.horizon_days'] ?? ''}</div>
}

describe('CountdownsSettings', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not overwrite an in-progress edit when the config query refreshes', async () => {
    const fetchMock = stubFetch({
      'countdowns.calendar_id': 'family',
      'countdowns.horizon_days': '30',
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        {/* The probe is the synchronisation point: react-query notifies its
         *  observers a tick after the refetch resolves, so asserting straight
         *  after `invalidateQueries` would pass before the new config had
         *  reached any component at all — and would go on passing against a
         *  form that re-seeded itself on every poll. */}
        <Probe />
        <CountdownsSettings />
      </QueryClientProvider>,
    )
    await screen.findByDisplayValue('30')

    fireEvent.change(screen.getByDisplayValue('30'), { target: { value: '99' } })

    // A poll lands, carrying an outright change made elsewhere. It may not
    // reach into a form someone is in the middle of filling in.
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/config') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ 'countdowns.horizon_days': '45' }),
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(CALENDARS)),
      } as Response)
    })
    await act(async () => {
      await client.invalidateQueries({ queryKey: CONFIG_QUERY_KEY })
    })
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('45'))

    expect(screen.getByDisplayValue('99')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('45')).not.toBeInTheDocument()
  })
})

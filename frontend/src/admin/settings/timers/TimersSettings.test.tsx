import { describe, expect, it, vi, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TimersSettings } from './TimersSettings'
import { CONFIG_QUERY_KEY, useAllConfig } from '@/platform'

/** A second consumer of the shared query, so a test can tell when a refresh
 *  has actually reached the components rather than just the cache. */
function Probe() {
  const { data } = useAllConfig()
  return <div data-testid="probe">{data?.['timers.service_url'] ?? ''}</div>
}

function stubConfig(config: Record<string, string>) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(config) })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderPanel(client: QueryClient = newClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, ...render(<TimersSettings />, { wrapper }) }
}

describe('TimersSettings', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('prefills from the shared config query rather than a fetch of its own', async () => {
    const fetchMock = stubConfig({
      'timers.service_url': 'http://timer.local:3380',
      'timers.alarm_sound': 'chime',
    })
    const client = newClient()
    renderPanel(client)
    renderPanel(client)

    await waitFor(() =>
      expect(screen.getAllByDisplayValue('http://timer.local:3380')).toHaveLength(2),
    )
    const configCalls = fetchMock.mock.calls.filter(([u]) => String(u) === '/api/config')
    expect(configCalls).toHaveLength(1)
  })

  // The property the whole one-shot prefill exists for. Unsaved edits live
  // only in this component's state — they are never in /api/config — so a
  // form that re-read the query would throw away whatever someone had typed
  // on the next poll tick, with nobody else having changed a thing.
  it('does not overwrite an in-progress edit when the config query refreshes', async () => {
    const fetchMock = stubConfig({ 'timers.service_url': 'http://timer.local:3380' })
    const client = newClient()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    render(
      <>
        {/* The probe is the synchronisation point: react-query notifies its
         *  observers a tick after the refetch resolves, so asserting straight
         *  after `invalidateQueries` would pass before the new config had
         *  reached any component at all — and would go on passing against a
         *  form that re-seeded itself on every poll. Waiting for a *second*
         *  consumer to show the new value proves the refresh landed, and only
         *  then is the untouched input worth anything. */}
        <Probe />
        <TimersSettings />
      </>,
      { wrapper },
    )
    await waitFor(() =>
      expect(screen.getByDisplayValue('http://timer.local:3380')).toBeInTheDocument(),
    )

    fireEvent.change(screen.getByDisplayValue('http://timer.local:3380'), {
      target: { value: 'http://still-typing' },
    })
    expect(screen.getByDisplayValue('http://still-typing')).toBeInTheDocument()

    // A poll lands — carrying an outright change made elsewhere. It may not
    // reach into a form someone is in the middle of filling in.
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 'timers.service_url': 'http://someone-else-changed-it' }),
    })
    await act(async () => {
      await client.invalidateQueries({ queryKey: CONFIG_QUERY_KEY })
    })
    await waitFor(() =>
      expect(screen.getByTestId('probe')).toHaveTextContent('http://someone-else-changed-it'),
    )

    expect(screen.getByDisplayValue('http://still-typing')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('http://someone-else-changed-it')).not.toBeInTheDocument()
  })

  it('saves both keys in one mutation and refreshes the shared config once', async () => {
    const table: Record<string, string> = {
      'timers.service_url': 'http://timer.local:3380',
      'timers.alarm_sound': 'chime',
    }
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/config') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ...table }) } as Response)
      }
      const key = decodeURIComponent(url.slice('/api/config/'.length))
      table[key] = (JSON.parse(String(init?.body)) as { value: string }).value
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response)
    })
    vi.stubGlobal('fetch', fetchMock)

    const client = newClient()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    render(
      <>
        <Probe />
        <TimersSettings />
      </>,
      { wrapper },
    )
    await waitFor(() =>
      expect(screen.getByDisplayValue('http://timer.local:3380')).toBeInTheDocument(),
    )
    const readsBefore = fetchMock.mock.calls.filter(([u]) => String(u) === '/api/config').length

    fireEvent.change(screen.getByDisplayValue('http://timer.local:3380'), {
      target: { value: 'http://new-url' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    })

    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('http://new-url'))

    const readsAfter = fetchMock.mock.calls.filter(([u]) => String(u) === '/api/config').length
    expect(readsAfter - readsBefore).toBe(1)
    expect(await screen.findByText('Saved!')).toBeInTheDocument()
  })

  it('says so when the config cannot be loaded, instead of hanging on Loading', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    renderPanel()

    expect(await screen.findByText('Failed to load settings')).toBeInTheDocument()
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })
})

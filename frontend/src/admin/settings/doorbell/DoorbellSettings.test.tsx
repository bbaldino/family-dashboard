import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DoorbellSettings } from './DoorbellSettings'
import { CONFIG_QUERY_KEY, useAllConfig } from '@/platform'

/**
 * The one-shot prefill. This form reads the shared `/api/config` query once,
 * at mount, and ignores every later value — because unsaved edits live only
 * in its own state and are never in `/api/config`, so a form that tracked
 * the query would throw away whatever someone had typed on the next poll
 * tick, with nobody else having changed a thing.
 */

function stubConfig(config: Record<string, string>) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(config) })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** A second consumer of the shared query, so a test can tell when a refresh
 *  has actually reached the components rather than just the cache. */
function Probe() {
  const { data } = useAllConfig()
  return <div data-testid="probe">{data?.['doorbell.camera_url'] ?? ''}</div>
}

describe('DoorbellSettings', () => {
  beforeEach(() => {
    // jsdom has no Permissions API; the mic-permission probe runs on mount.
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: () => Promise.resolve({ state: 'granted', onchange: null }) },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not overwrite an in-progress edit when the config query refreshes', async () => {
    const fetchMock = stubConfig({ 'doorbell.camera_url': 'http://doorbell.local/view' })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        {/* The probe is the synchronisation point: react-query notifies its
         *  observers a tick after the refetch resolves, so asserting straight
         *  after `invalidateQueries` would pass before the new config had
         *  reached any component at all — and would go on passing against a
         *  form that re-seeded itself on every poll. */}
        <Probe />
        <DoorbellSettings />
      </QueryClientProvider>,
    )
    await screen.findByDisplayValue('http://doorbell.local/view')

    fireEvent.change(screen.getByDisplayValue('http://doorbell.local/view'), {
      target: { value: 'http://still-typing' },
    })

    // A poll lands, carrying an outright change made elsewhere. It may not
    // reach into a form someone is in the middle of filling in.
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 'doorbell.camera_url': 'http://someone-else-changed-it' }),
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
})

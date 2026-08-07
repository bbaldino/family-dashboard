import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SettingsAdmin } from './SettingsAdmin'
import { CONFIG_QUERY_KEY, useAllConfig } from '@/platform'

/**
 * The one-shot prefill. This screen reads the shared `/api/config` query
 * once, at mount, and ignores every later value — because unsaved edits live
 * only in its own `localConfig` and are never in `/api/config`, so a screen
 * that tracked the query would throw away whatever someone had typed on the
 * next poll tick, with nobody else having changed a thing. That state spans
 * every integration at once rather than resetting per tab, so the edit at
 * risk may not even be on the tab that is showing.
 */

// The first sidebar entry has its own settings component, which mounts (and
// fetches) before anything here can pick a different tab. It is not what
// this file is about.
vi.mock('@/admin/ChoreAdmin', () => ({ ChoreAdmin: () => <div>Chores</div> }))

function stubConfig(config: Record<string, string>) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(config) })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** A second consumer of the shared query, so a test can tell when a refresh
 *  has actually reached the components rather than just the cache. */
function Probe() {
  const { data } = useAllConfig()
  return <div data-testid="probe">{data?.['weather.lat'] ?? ''}</div>
}

describe('SettingsAdmin', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not overwrite an in-progress edit when the config query refreshes', async () => {
    const fetchMock = stubConfig({ 'weather.lat': '37.2504' })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        {/* The probe is the synchronisation point: react-query notifies its
         *  observers a tick after the refetch resolves, so asserting straight
         *  after `invalidateQueries` would pass before the new config had
         *  reached any component at all — and would go on passing against a
         *  form that re-seeded itself on every poll. */}
        <Probe />
        <SettingsAdmin />
      </QueryClientProvider>,
    )
    // Weather has no bespoke settings component, so it renders the generic
    // field form this screen owns.
    fireEvent.click(await screen.findByRole('button', { name: 'Weather' }))
    await screen.findByDisplayValue('37.2504')

    fireEvent.change(screen.getByDisplayValue('37.2504'), { target: { value: '48.8566' } })

    // A poll lands, carrying an outright change made elsewhere. It may not
    // reach into a form someone is in the middle of filling in.
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 'weather.lat': '51.5072' }),
    })
    await act(async () => {
      await client.invalidateQueries({ queryKey: CONFIG_QUERY_KEY })
    })
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('51.5072'))

    expect(screen.getByDisplayValue('48.8566')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('51.5072')).not.toBeInTheDocument()
  })
})

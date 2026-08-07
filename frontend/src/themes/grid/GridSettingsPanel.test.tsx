import { describe, expect, it, vi, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GridSettingsPanel } from './GridSettingsPanel'
import { gridSettingsFields } from './settings-declaration'
import { CONFIG_QUERY_KEY, useAllConfig } from '@/platform'

/** A second consumer of the shared query, so a test can tell when a refresh
 *  has actually reached the components rather than just the cache. */
function Probe() {
  const { data } = useAllConfig()
  return <div data-testid="probe">{data?.['theme.grid.columns'] ?? ''}</div>
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
  return { client, ...render(<GridSettingsPanel />, { wrapper }) }
}

describe('GridSettingsPanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders field labels from the settings declaration, not a hardcoded copy', async () => {
    stubConfig({})
    const original = gridSettingsFields.columns.label
    gridSettingsFields.columns.label = 'Custom columns label'
    try {
      renderPanel()
      expect(await screen.findByText('Custom columns label')).toBeInTheDocument()
    } finally {
      gridSettingsFields.columns.label = original
    }
  })

  it('prefills from the shared config query rather than a fetch of its own', async () => {
    const fetchMock = stubConfig({ 'theme.grid.columns': '9', 'theme.grid.rows': '4' })
    const client = newClient()
    renderPanel(client)
    renderPanel(client)

    await waitFor(() => expect(screen.getAllByDisplayValue('9')).toHaveLength(2))
    const configCalls = fetchMock.mock.calls.filter(([u]) => String(u) === '/api/config')
    expect(configCalls).toHaveLength(1)
  })

  it('unchecks the widgets listed in theme.grid.hidden', async () => {
    stubConfig({ 'theme.grid.hidden': 'sports,chores' })
    renderPanel()

    const sports = await screen.findByLabelText('Sports')
    expect(sports).not.toBeChecked()
    expect(screen.getByLabelText('Calendar')).toBeChecked()
  })

  // The property the whole one-shot prefill exists for. Unsaved edits live
  // only in this component's state — they are never in /api/config — so a
  // panel that re-read the query would throw away whatever someone had typed
  // on the next poll tick, with nobody else having changed a thing.
  it('does not overwrite an in-progress edit when the config query refreshes', async () => {
    const fetchMock = stubConfig({ 'theme.grid.columns': '8' })
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
         *  panel that re-seeded itself on every poll. Waiting for a *second*
         *  consumer to show the new value proves the refresh landed, and only
         *  then is the untouched input worth anything. */}
        <Probe />
        <GridSettingsPanel />
      </>,
      { wrapper },
    )
    await waitFor(() => expect(screen.getByDisplayValue('8')).toBeInTheDocument())

    fireEvent.change(screen.getByDisplayValue('8'), { target: { value: '12' } })
    expect(screen.getByDisplayValue('12')).toBeInTheDocument()

    // A poll lands — carrying an outright change made elsewhere. It may not
    // reach into a form someone is in the middle of filling in.
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 'theme.grid.columns': '3' }),
    })
    await act(async () => {
      await client.invalidateQueries({ queryKey: CONFIG_QUERY_KEY })
    })
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('3'))

    expect(screen.getByDisplayValue('12')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('3')).not.toBeInTheDocument()
  })

  it('says so when the config cannot be loaded, instead of hanging on Loading', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    renderPanel()

    expect(await screen.findByText('Failed to load settings')).toBeInTheDocument()
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })
})

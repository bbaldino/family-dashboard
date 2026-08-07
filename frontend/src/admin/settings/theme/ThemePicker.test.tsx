import type { ReactNode } from 'react'
import { z } from 'zod'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemePicker } from './ThemePicker'
import { registerTheme, _resetRegistry } from '@/shell/ThemeRegistry'
import { CONFIG_QUERY_KEY, useAllConfig } from '@/platform'
import type { ThemeModule } from '@/shell/types'

const stub = (id: string, name: string): ThemeModule => ({
  id,
  name,
  canvas: { model: 'fluid' },
  screens: { home: () => <div /> },
  overlays: [],
})

const gridStub = (): ThemeModule => ({
  ...stub('grid', 'Cards Grid'),
  settings: {
    schema: z.object({ columns: z.coerce.number().int().default(8) }),
    fields: { columns: { label: 'Grid columns' } },
    Component: () => <div>Grid columns</div>,
  },
})

/** The picker saves through the platform's shared config mutation, so it
 *  needs a client — the same one the rest of the admin screen renders under. */
function renderPicker() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return render(<ThemePicker />, { wrapper })
}

function seedConfig(config: Record<string, string>) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(config) }),
  )
}

describe('ThemePicker', () => {
  beforeEach(() => {
    _resetRegistry()
    registerTheme(gridStub())
    registerTheme(stub('broadsheet', 'Broadsheet'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    _resetRegistry()
  })

  it('lists every registered theme by name', async () => {
    renderPicker()
    await waitFor(() => expect(screen.getByText('Cards Grid')).toBeInTheDocument())
    expect(screen.getByText('Broadsheet')).toBeInTheDocument()
  })

  it('marks the configured theme as selected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ 'theme.presentation': 'broadsheet' }),
      }),
    )
    renderPicker()
    await waitFor(() => expect(screen.getByRole('radio', { name: /Broadsheet/ })).toBeChecked())
  })

  it('defaults to grid when no theme is configured', async () => {
    renderPicker()
    await waitFor(() => expect(screen.getByRole('radio', { name: /Cards Grid/ })).toBeChecked())
  })

  it('persists the choice to theme.presentation', async () => {
    renderPicker()
    await waitFor(() => expect(screen.getByText('Broadsheet')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('radio', { name: /Broadsheet/ }))

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/config/theme.presentation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 'broadsheet' }),
      }),
    )
  })

  it('rolls back the selection and shows an error when the save fails', async () => {
    // The PUT had no `catch` — a failed save became an unhandled rejection
    // while the radio stayed optimistically selected, so the UI claimed a
    // save that never happened. It must roll back and say so.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/config') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ 'theme.presentation': 'grid' }),
          })
        }
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })
      }),
    )
    renderPicker()
    await waitFor(() => expect(screen.getByRole('radio', { name: /Cards Grid/ })).toBeChecked())

    fireEvent.click(screen.getByRole('radio', { name: /Broadsheet/ }))

    await waitFor(() => expect(screen.getByText(/couldn.t save/i)).toBeInTheDocument())
    expect(screen.getByRole('radio', { name: /Cards Grid/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Broadsheet/ })).not.toBeChecked()
  })

  it("renders the selected theme's settings", async () => {
    seedConfig({ 'theme.presentation': 'grid' })
    renderPicker()
    expect(await screen.findByText('Grid columns')).toBeInTheDocument()
  })

  it('renders no settings section for a theme that declares none', async () => {
    seedConfig({ 'theme.presentation': 'broadsheet' })
    renderPicker()
    // 'Broadsheet' is the radio label — present at first render regardless
    // of whether config has resolved, since `selected` starts as 'grid'.
    // Wait on the radio actually being checked, which only happens once the
    // fetched config has been applied, or this assertion can run before
    // grid's own settings (whose Component renders "Grid columns") have
    // been swapped out.
    await waitFor(() => expect(screen.getByRole('radio', { name: /Broadsheet/ })).toBeChecked())
    expect(screen.queryByText('Grid columns')).not.toBeInTheDocument()
  })

  it('swaps the settings when a different theme is selected', async () => {
    seedConfig({ 'theme.presentation': 'broadsheet' })
    renderPicker()
    // Same reasoning as above: wait for the config-driven selection, not for
    // the always-present radio label.
    await waitFor(() => expect(screen.getByRole('radio', { name: /Broadsheet/ })).toBeChecked())
    expect(screen.queryByText('Grid columns')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /Cards Grid/ }))

    expect(await screen.findByText('Grid columns')).toBeInTheDocument()
  })
})

/** A second consumer of the shared query, so a test can tell when a refresh
 *  has actually reached the components rather than just the cache. */
function Probe() {
  const { data } = useAllConfig()
  return <div data-testid="probe">{data?.['theme.presentation'] ?? ''}</div>
}

describe('ThemePicker prefill', () => {
  beforeEach(() => {
    _resetRegistry()
    registerTheme(gridStub())
    registerTheme(stub('broadsheet', 'Broadsheet'))
    registerTheme(stub('ledger', 'Ledger'))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    _resetRegistry()
  })

  // The property the one-shot prefill exists for. The radio moves the moment
  // it is clicked, before the write has landed, so that choice lives only in
  // this component's state — a form that tracked the query would have a poll
  // tick yank the selection out from under whoever just made it.
  it('does not overwrite an in-progress choice when the config query refreshes', async () => {
    let landWrite = () => {}
    const writeInFlight = new Promise<void>((resolve) => {
      landWrite = resolve
    })
    let presentation = 'grid'
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === '/api/config') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ 'theme.presentation': presentation }),
        } as Response)
      }
      return writeInFlight.then(() => ({ ok: true, json: () => Promise.resolve({}) }) as Response)
    })
    vi.stubGlobal('fetch', fetchMock)

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    render(
      <QueryClientProvider client={client}>
        {/* The probe is the synchronisation point: react-query notifies its
         *  observers a tick after the refetch resolves, so asserting straight
         *  after `invalidateQueries` would pass before the new config had
         *  reached any component at all. */}
        <Probe />
        <ThemePicker />
      </QueryClientProvider>,
    )
    await waitFor(() => expect(screen.getByRole('radio', { name: /Cards Grid/ })).toBeChecked())

    // Chosen, write still in flight.
    fireEvent.click(screen.getByRole('radio', { name: /Broadsheet/ }))
    await waitFor(() => expect(screen.getByRole('radio', { name: /Broadsheet/ })).toBeChecked())

    // A poll lands, carrying a change made elsewhere entirely.
    presentation = 'ledger'
    await act(async () => {
      await client.invalidateQueries({ queryKey: CONFIG_QUERY_KEY })
    })
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('ledger'))

    expect(screen.getByRole('radio', { name: /Broadsheet/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Ledger/ })).not.toBeChecked()

    landWrite()
  })
})

import { describe, expect, it, vi, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CONFIG_QUERY_KEY, useAllConfig } from '@/platform'
import { ThemeSettings } from './ThemeSettings'
import { EARTH_TONES, OCEAN } from './types'

const EARTH_COLORS = EARTH_TONES.colors

// The live preview renders a whole real dashboard screen — a router, a
// ResizeObserver and every widget's queries. None of that is what this file
// is about, and all of it would drown the save path in unrelated setup.
vi.mock('./ThemePreview', () => ({ ThemePreview: () => <div data-testid="preview" /> }))

/**
 * Every write on this screen is optimistic: `useTheme` seeds the shared
 * config cache so the whole dashboard repaints before the round trip
 * finishes. That makes a rejected write the interesting case — with no
 * `catch` it produced an unhandled rejection, no message at all, and a
 * palette on screen that the server had refused, standing until the next
 * poll corrected it up to a minute later. Indistinguishable from success.
 */

/** A second consumer of the shared config query, so a test can tell when a
 *  refresh has actually reached the components rather than just the cache. */
function Probe() {
  const { data } = useAllConfig()
  return <div data-testid="probe">{data?.['timers.service_url'] ?? ''}</div>
}

/** A config table that remembers writes, since a save invalidates the shared
 *  query and the very next thing that happens is a re-read. The table is
 *  returned so a test can also change it from underneath, the way an edit
 *  made on another screen would. `failWrites` makes every PUT respond 500
 *  without touching the table. */
function stubConfig(config: Record<string, string>, failWrites = false) {
  const table = { ...config }
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === '/api/config') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ...table }) } as Response)
    }
    if (url.startsWith('/api/config/')) {
      if (failWrites) {
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })
      }
      const key = decodeURIComponent(url.slice('/api/config/'.length))
      if (init?.method === 'PUT') {
        table[key] = (JSON.parse(String(init.body)) as { value: string }).value
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response)
    }
    return Promise.reject(new Error(`Unexpected fetch url: ${url}`))
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, table }
}

function renderSettings() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return {
    client,
    ...render(
      <>
        <Probe />
        <ThemeSettings />
      </>,
      { wrapper },
    ),
  }
}

/** The selector pill for a theme; the active one carries `border-palette-1`. */
function pill(name: string) {
  return screen.getByRole('button', { name: new RegExp(`^${name}$`) })
}

/** `#rrggbb` as jsdom serialises it back out of a `style` attribute. */
function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

/** A swatch, found by the label the editor renders underneath it. */
function swatch(label: string) {
  return screen.getByText(label).previousElementSibling as HTMLElement
}

/** Taps a swatch open and picks the first colour in its grid — the closest
 *  thing to someone half way through recolouring a palette. */
const PICKED = '#e53935' // first entry of the editor's tap-to-pick grid
function editSwatch(label: string) {
  fireEvent.click(swatch(label))
  const grid = document.querySelector('.grid-cols-10')
  fireEvent.click(grid!.firstElementChild as HTMLElement)
}

const KITCHEN = { id: 'kitchen', name: 'Kitchen', builtin: false, colors: EARTH_COLORS }

describe('ThemeSettings', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('selects a theme and marks it active', async () => {
    stubConfig({ 'theme.active': 'earth-tones' })
    renderSettings()
    await waitFor(() => expect(pill('Earth Tones')).toHaveClass('border-palette-1'))

    fireEvent.click(pill('Ocean'))

    await waitFor(() => expect(pill('Ocean')).toHaveClass('border-palette-1'))
    expect(screen.queryByText('Failed to save theme')).not.toBeInTheDocument()
  })

  it('says the save failed and puts the previous theme back', async () => {
    stubConfig({ 'theme.active': 'earth-tones' }, true)
    renderSettings()
    await waitFor(() => expect(pill('Earth Tones')).toHaveClass('border-palette-1'))

    fireEvent.click(pill('Ocean'))

    expect(await screen.findByText('Failed to save theme')).toBeInTheDocument()
    // The optimistic seed is gone: the dashboard is back on the palette the
    // server actually holds, rather than one nobody stored.
    expect(pill('Earth Tones')).toHaveClass('border-palette-1')
    expect(pill('Ocean')).not.toHaveClass('border-palette-1')
  })

  it('says the save failed when storing an edited custom theme is rejected', async () => {
    stubConfig(
      { 'theme.active': 'kitchen', 'theme.custom_themes': JSON.stringify([KITCHEN]) },
      true,
    )
    renderSettings()
    await waitFor(() => expect(pill('Kitchen')).toHaveClass('border-palette-1'))

    fireEvent.click(screen.getByRole('button', { name: 'Save Theme' }))

    expect(await screen.findByText('Failed to save theme')).toBeInTheDocument()
    expect(screen.queryByText('Saved!')).not.toBeInTheDocument()
  })

  it('creates a theme with one save, so one click refetches the config once', async () => {
    // "+ New Theme" stores the theme and selects it. As two mutations that
    // was two invalidations and two reads of the whole config table for a
    // single click; `useSaveConfig` takes a batch precisely so it is one.
    const { fetchMock } = stubConfig({ 'theme.active': 'earth-tones' })
    renderSettings()
    await waitFor(() => expect(pill('Earth Tones')).toHaveClass('border-palette-1'))
    const readsBefore = fetchMock.mock.calls.filter(([u]) => String(u) === '/api/config').length

    fireEvent.click(screen.getByRole('button', { name: '+ New Theme' }))

    await waitFor(() => expect(pill('Earth Tones Copy')).toHaveClass('border-palette-1'))
    const reads = fetchMock.mock.calls.filter(([u]) => String(u) === '/api/config')
    expect(reads.length - readsBefore).toBe(1)
  })

  // The property the seed-once split exists for, and the reason this screen
  // needed it more than the other nine: unsaved swatches live only in this
  // component's state, and a *custom* theme is re-parsed out of the config
  // JSON into a brand new object every time anything in the table changes.
  // Following that object's identity meant an unrelated setting saved on
  // another tab silently took the recolouring with it.
  it('keeps in-progress swatch edits when an unrelated config change lands', async () => {
    const { table } = stubConfig({
      'theme.active': 'kitchen',
      'theme.custom_themes': JSON.stringify([KITCHEN]),
      'timers.service_url': 'http://timer.local',
    })
    const { client } = renderSettings()
    await waitFor(() => expect(pill('Kitchen')).toHaveClass('border-palette-1'))

    editSwatch('P1')
    expect(swatch('P1')).toHaveStyle({ background: rgb(PICKED) })

    // Someone saves something unrelated on another settings tab.
    table['timers.service_url'] = 'http://someone-else-changed-it'
    await act(async () => {
      await client.invalidateQueries({ queryKey: CONFIG_QUERY_KEY })
    })
    // The probe is the synchronisation point: react-query notifies its
    // observers a tick after the refetch resolves, so asserting straight
    // after `invalidateQueries` would pass before the new config had reached
    // any component at all — and would go on passing against an editor that
    // re-seeded itself on every config change.
    await waitFor(() =>
      expect(screen.getByTestId('probe')).toHaveTextContent('http://someone-else-changed-it'),
    )

    expect(swatch('P1')).toHaveStyle({ background: rgb(PICKED) })
  })

  // The same property, isolated. `useTheme` now narrows its parse to the
  // stored theme string, so most unrelated saves no longer hand this screen a
  // new `activeTheme` object at all — which means the test above passes on
  // that alone, and would keep passing even if the seeding started following
  // the theme's identity again. This one changes the stored theme list itself,
  // the way creating a theme on another tab does: the re-parse is unavoidable,
  // `Kitchen` arrives as a brand new object under the same id, and only the
  // seed-once split can keep the edits.
  it('keeps in-progress swatch edits when the theme it is editing is re-parsed', async () => {
    const PORCH = { id: 'porch', name: 'Porch', builtin: false, colors: OCEAN.colors }
    const { table } = stubConfig({
      'theme.active': 'kitchen',
      'theme.custom_themes': JSON.stringify([KITCHEN]),
    })
    const { client } = renderSettings()
    await waitFor(() => expect(pill('Kitchen')).toHaveClass('border-palette-1'))

    editSwatch('P1')
    expect(swatch('P1')).toHaveStyle({ background: rgb(PICKED) })

    table['theme.custom_themes'] = JSON.stringify([KITCHEN, PORCH])
    await act(async () => {
      await client.invalidateQueries({ queryKey: CONFIG_QUERY_KEY })
    })
    // The new pill is the synchronisation point: it can only render once the
    // re-parsed list has reached the component, so the assertion below is
    // made against an editor that has already seen the new `Kitchen` object.
    await screen.findByRole('button', { name: /^Porch$/ })

    expect(swatch('P1')).toHaveStyle({ background: rgb(PICKED) })
  })

  it('re-seeds the swatches when the theme is deliberately switched', async () => {
    stubConfig({ 'theme.active': 'kitchen', 'theme.custom_themes': JSON.stringify([KITCHEN]) })
    renderSettings()
    await waitFor(() => expect(pill('Kitchen')).toHaveClass('border-palette-1'))

    editSwatch('P1')
    expect(swatch('P1')).toHaveStyle({ background: rgb(PICKED) })

    fireEvent.click(pill('Ocean'))

    await waitFor(() =>
      expect(swatch('P1')).toHaveStyle({ background: rgb(OCEAN.colors.palette[0]) }),
    )
  })

  // The other half of the same fix, pulling the opposite way: the editor no
  // longer follows the config object, so a rejected write has to put the
  // stored colours back explicitly. Otherwise a failed save leaves the
  // swatches showing a palette nobody stored — while the dashboard behind
  // them has already rolled back to the one that is.
  it('puts the stored colours back when saving an edited palette is rejected', async () => {
    stubConfig(
      { 'theme.active': 'kitchen', 'theme.custom_themes': JSON.stringify([KITCHEN]) },
      true,
    )
    renderSettings()
    await waitFor(() => expect(pill('Kitchen')).toHaveClass('border-palette-1'))

    editSwatch('P1')
    expect(swatch('P1')).toHaveStyle({ background: rgb(PICKED) })

    fireEvent.click(screen.getByRole('button', { name: 'Save Theme' }))

    expect(await screen.findByText('Failed to save theme')).toBeInTheDocument()
    await waitFor(() =>
      expect(swatch('P1')).toHaveStyle({ background: rgb(EARTH_COLORS.palette[0]) }),
    )
  })
})

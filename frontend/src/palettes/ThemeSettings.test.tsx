import { describe, expect, it, vi, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeSettings } from './ThemeSettings'
import { EARTH_TONES } from './types'

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

/** A config table that remembers writes, since a save invalidates the shared
 *  query and the very next thing that happens is a re-read. `failWrites`
 *  makes every PUT respond 500 without touching the table. */
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
  return fetchMock
}

function renderSettings() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, ...render(<ThemeSettings />, { wrapper }) }
}

/** The selector pill for a theme; the active one carries `border-palette-1`. */
function pill(name: string) {
  return screen.getByRole('button', { name: new RegExp(`^${name}$`) })
}

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
      {
        'theme.active': 'kitchen',
        'theme.custom_themes': JSON.stringify([
          { id: 'kitchen', name: 'Kitchen', builtin: false, colors: EARTH_COLORS },
        ]),
      },
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
    const fetchMock = stubConfig({ 'theme.active': 'earth-tones' })
    renderSettings()
    await waitFor(() => expect(pill('Earth Tones')).toHaveClass('border-palette-1'))
    const readsBefore = fetchMock.mock.calls.filter(([u]) => String(u) === '/api/config').length

    fireEvent.click(screen.getByRole('button', { name: '+ New Theme' }))

    await waitFor(() => expect(pill('Earth Tones Copy')).toHaveClass('border-palette-1'))
    const reads = fetchMock.mock.calls.filter(([u]) => String(u) === '/api/config')
    expect(reads.length - readsBefore).toBe(1)
  })
})

import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeMount } from './ThemeMount'
import { registerTheme, _resetRegistry } from './ThemeRegistry'
import type { ThemeModule } from './types'
import { CONFIG_QUERY_KEY } from '@/platform'

/** The palette (and, below, the presentation choice) is read through the
 *  shared config query, so the mount needs a client the way the real app
 *  gives it one. */
function renderMount(initialEntries: string[] = ['/']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <ThemeMount />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...result, client }
}

function seedConfig(config: Record<string, string>) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(config) }),
  )
}

const gridStub: ThemeModule = {
  id: 'grid',
  name: 'Grid',
  canvas: { model: 'fluid' },
  screens: { home: () => <div data-testid="grid-home">grid-home</div> },
  overlays: [],
}

const broadsheetStub: ThemeModule = {
  id: 'broadsheet',
  name: 'Broadsheet',
  canvas: {
    model: 'fixed-scale',
    designWidth: 1600,
    designHeight: 900,
    minViewportWidth: 800,
  },
  screens: { home: () => <div data-testid="broadsheet-home">bs-home</div> },
  overlays: [],
}

function mockConfig(value: string | null) {
  const body: Record<string, string> = value === null ? {} : { 'theme.presentation': value }
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(body),
    }),
  )
}

describe('ThemeMount', () => {
  beforeEach(() => {
    _resetRegistry()
    registerTheme(gridStub)
    registerTheme(broadsheetStub)
    Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true, writable: true })
    Object.defineProperty(window, 'innerHeight', {
      value: 1080,
      configurable: true,
      writable: true,
    })
  })

  it('mounts the theme named in config', async () => {
    mockConfig('broadsheet')
    renderMount()
    await waitFor(() => expect(screen.getByTestId('broadsheet-home')).toBeInTheDocument())
  })

  it('falls back to grid when the config value is unknown', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockConfig('nonexistent-theme')
    renderMount()
    await waitFor(() => expect(screen.getByTestId('grid-home')).toBeInTheDocument())
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown theme "nonexistent-theme"'),
    )
    warnSpy.mockRestore()
  })

  it('falls back to grid when the config value is missing', async () => {
    mockConfig(null)
    renderMount()
    await waitFor(() => expect(screen.getByTestId('grid-home')).toBeInTheDocument())
  })

  it('wraps a fixed-scale theme in the canvas scaler', async () => {
    mockConfig('broadsheet')
    renderMount()
    await waitFor(() => expect(screen.getByTestId('theme-canvas')).toBeInTheDocument())
  })

  it('does NOT wrap a fluid theme in the canvas scaler', async () => {
    mockConfig('grid')
    renderMount()
    await waitFor(() => expect(screen.getByTestId('grid-home')).toBeInTheDocument())
    expect(screen.queryByTestId('theme-canvas')).not.toBeInTheDocument()
  })

  it('names the specific missing screen when a theme omits it, instead of "unknown"', async () => {
    const homeOnlyStub: ThemeModule = {
      id: 'grid',
      name: 'Grid',
      canvas: { model: 'fluid' },
      screens: { home: () => <div data-testid="grid-home">grid-home</div> },
      overlays: [],
    }
    _resetRegistry()
    registerTheme(homeOnlyStub)
    mockConfig('grid')
    renderMount(['/calendar'])
    await waitFor(() => expect(screen.getByText(/calendar/i)).toBeInTheDocument())
    expect(screen.queryByText(/unknown/i)).not.toBeInTheDocument()
  })

  it('switches presentation when theme.presentation changes, with no remount', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 'theme.presentation': 'grid' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { client } = renderMount()
    await waitFor(() => expect(screen.getByTestId('grid-home')).toBeInTheDocument())

    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 'theme.presentation': 'broadsheet' }),
    })
    await act(async () => {
      await client.invalidateQueries({ queryKey: CONFIG_QUERY_KEY })
    })

    await waitFor(() => expect(screen.getByTestId('broadsheet-home')).toBeInTheDocument())
  })

  // The config query now polls underneath the whole dashboard. On the
  // tablet that means the fixed-scale canvas re-renders every 60s where it
  // used to render once — so an unchanged refetch must not replace the
  // canvas element, which would remount every screen inside it and
  // re-run the scale calculation visibly.
  it('keeps the same canvas element across a refetch that changes nothing', async () => {
    mockConfig('broadsheet')
    const { client } = renderMount()
    await waitFor(() => expect(screen.getByTestId('theme-canvas')).toBeInTheDocument())
    const before = screen.getByTestId('theme-canvas')
    const beforeTransform = before.style.transform

    await act(async () => {
      await client.invalidateQueries({ queryKey: CONFIG_QUERY_KEY })
    })

    expect(screen.getByTestId('theme-canvas')).toBe(before)
    expect(screen.getByTestId('theme-canvas').style.transform).toBe(beforeTransform)
  })

  it('reads the presentation and the palette off one shared request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 'theme.presentation': 'grid', 'theme.active': 'ocean' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    renderMount()
    await waitFor(() => expect(screen.getByTestId('grid-home')).toBeInTheDocument())

    const configCalls = fetchMock.mock.calls.filter(([u]) => String(u) === '/api/config')
    expect(configCalls).toHaveLength(1)
  })

  it('applies the active palette to its own root, not the document', async () => {
    seedConfig({ 'theme.active': 'earth-tones' })
    const { container } = renderMount()

    await waitFor(() => expect(container.firstElementChild).toBeTruthy())
    const root = container.firstElementChild as HTMLElement

    expect(root.style.getPropertyValue('--color-bg-primary')).not.toBe('')
    // The point of the whole change: nothing lands on the document root.
    expect(document.documentElement.style.getPropertyValue('--color-bg-primary')).toBe('')
  })
})

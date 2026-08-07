import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeMount } from './ThemeMount'
import { registerTheme, _resetRegistry } from './ThemeRegistry'
import type { ThemeModule } from './types'

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

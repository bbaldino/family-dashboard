import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTheme } from './useTheme'
import { CONFIG_QUERY_KEY } from '@/platform'
import { EARTH_TONES } from './types'
import type { Theme } from './types'

/**
 * The palette used to be read once at mount and never again, which is why
 * changing the theme has always needed a page reload. These pin the two
 * things that stop being true: the read goes through the shared config
 * query, and a change to `theme.active` reaches a live hook with no remount.
 */

const CUSTOM: Theme = {
  ...EARTH_TONES,
  id: 'kitchen-night',
  name: 'Kitchen Night',
  builtin: false,
}

function stubConfig(config: Record<string, string>) {
  const fetchMock = vi.fn((...args: Parameters<typeof fetch>) => {
    const url = String(args[0])
    if (url === '/api/config') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(config) } as Response)
    }
    if (url.startsWith('/api/config/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response)
    }
    return Promise.reject(new Error(`Unexpected fetch url: ${url}`))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('useTheme', () => {
  beforeEach(() => {
    stubConfig({})
  })
  afterEach(() => vi.unstubAllGlobals())

  it('reads the active theme through the shared config query', async () => {
    stubConfig({ 'theme.active': 'ocean' })
    const { result } = renderHook(() => useTheme(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(result.current.activeTheme.id).toBe('ocean'))
  })

  it('shares one /api/config request with the rest of the app', async () => {
    const fetchMock = stubConfig({ 'theme.active': 'ocean' })
    const client = newClient()
    const wrapper = wrapperFor(client)
    const a = renderHook(() => useTheme(), { wrapper })
    renderHook(() => useTheme(), { wrapper })

    await waitFor(() => expect(a.result.current.activeTheme.id).toBe('ocean'))

    const configCalls = fetchMock.mock.calls.filter(([u]) => String(u) === '/api/config')
    expect(configCalls).toHaveLength(1)
  })

  it('picks up a theme.active change with no remount', async () => {
    const fetchMock = stubConfig({ 'theme.active': 'ocean' })
    const client = newClient()
    const { result } = renderHook(() => useTheme(), { wrapper: wrapperFor(client) })
    await waitFor(() => expect(result.current.activeTheme.id).toBe('ocean'))

    fetchMock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ 'theme.active': 'forest' }),
      } as Response),
    )
    await act(async () => {
      await client.invalidateQueries({ queryKey: CONFIG_QUERY_KEY })
    })

    await waitFor(() => expect(result.current.activeTheme.id).toBe('forest'))
  })

  it('picks up custom themes stored in config', async () => {
    stubConfig({
      'theme.active': 'kitchen-night',
      'theme.custom_themes': JSON.stringify([CUSTOM]),
    })
    const { result } = renderHook(() => useTheme(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(result.current.activeTheme.id).toBe('kitchen-night'))
    expect(result.current.customThemes).toHaveLength(1)
    expect(result.current.allThemes.map((t) => t.id)).toContain('kitchen-night')
  })

  it('falls back to earth-tones when the custom theme list is not valid JSON', async () => {
    stubConfig({ 'theme.active': 'kitchen-night', 'theme.custom_themes': 'not json' })
    const { result } = renderHook(() => useTheme(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(result.current.customThemes).toEqual([]))
    expect(result.current.activeTheme.id).toBe('earth-tones')
  })

  it('shows a theme switch immediately rather than waiting for the next poll', async () => {
    // Seeded with a non-default theme so the wait below observes the fetch
    // actually landing: 'earth-tones' is also the pre-fetch fallback, so
    // waiting on it would pass before the query had resolved and the write
    // below would then race the in-flight response.
    const fetchMock = stubConfig({ 'theme.active': 'forest' })
    const client = newClient()
    const { result } = renderHook(() => useTheme(), { wrapper: wrapperFor(client) })
    await waitFor(() => expect(result.current.activeTheme.id).toBe('forest'))

    await act(async () => {
      await result.current.setActiveTheme('ocean')
    })

    await waitFor(() => expect(result.current.activeTheme.id).toBe('ocean'))
    expect(client.getQueryData(CONFIG_QUERY_KEY)).toMatchObject({ 'theme.active': 'ocean' })
    expect(
      fetchMock.mock.calls.some(
        ([u, init]) =>
          String(u) === '/api/config/theme.active' &&
          (init as RequestInit | undefined)?.method === 'PUT',
      ),
    ).toBe(true)
    // Still one config read: the switch showed off the local write alone, or
    // the picker would look dead for up to a minute.
    expect(fetchMock.mock.calls.filter(([u]) => String(u) === '/api/config')).toHaveLength(1)
  })

  it('shows a saved custom theme immediately', async () => {
    const fetchMock = stubConfig({ 'theme.active': 'forest' })
    const { result } = renderHook(() => useTheme(), { wrapper: wrapperFor(newClient()) })
    await waitFor(() => expect(result.current.activeTheme.id).toBe('forest'))
    expect(result.current.customThemes).toEqual([])

    await act(async () => {
      await result.current.saveCustomThemes([CUSTOM])
    })

    await waitFor(() => expect(result.current.customThemes).toEqual([CUSTOM]))
    expect(result.current.allThemes.map((t) => t.id)).toContain('kitchen-night')
    expect(fetchMock.mock.calls.filter(([u]) => String(u) === '/api/config')).toHaveLength(1)
  })
})

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTheme } from './useTheme'
import { CONFIG_QUERY_KEY, useAllConfig } from '@/platform'
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

/**
 * A config table that actually remembers writes.
 *
 * A save now invalidates the shared query, so the very next thing that
 * happens after a write is a re-read. A stub that always replayed its seed
 * would answer that re-read with the *old* value and make an optimistic
 * update look like it had been rolled back — which says nothing about the
 * hook and everything about the stub.
 */
function stubConfig(config: Record<string, string>) {
  const table = { ...config }
  const fetchMock = vi.fn((...args: Parameters<typeof fetch>) => {
    const url = String(args[0])
    const init = args[1]
    if (url === '/api/config') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ...table }) } as Response)
    }
    if (url.startsWith('/api/config/')) {
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

  it('hands out the same activeTheme object when an unrelated key changes', async () => {
    // Custom themes are parsed out of a JSON string, so memoizing them on the
    // whole config object gave every consumer a brand new `activeTheme` for a
    // timer setting or a sports team — churn with nothing behind it. A
    // built-in would pass this under any implementation (module constants keep
    // their reference), hence the custom theme.
    const stored = {
      'theme.active': CUSTOM.id,
      'theme.custom_themes': JSON.stringify([CUSTOM]),
    }
    const fetchMock = stubConfig(stored)
    const client = newClient()
    const { result } = renderHook(() => ({ theme: useTheme(), config: useAllConfig() }), {
      wrapper: wrapperFor(client),
    })
    await waitFor(() => expect(result.current.theme.activeTheme.id).toBe(CUSTOM.id))
    const before = result.current.theme.activeTheme

    fetchMock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ...stored, 'timers.service_url': 'http://timer.local' }),
      } as Response),
    )
    await act(async () => {
      await client.invalidateQueries({ queryKey: CONFIG_QUERY_KEY })
    })
    // Read through the same component as the hook under test, so this only
    // passes once the new config has actually reached a render — not merely
    // the cache.
    await waitFor(() =>
      expect(result.current.config.data?.['timers.service_url']).toBe('http://timer.local'),
    )

    expect(result.current.theme.activeTheme).toBe(before)
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
      await result.current.savePalette({ activeId: 'ocean' })
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
    // Two config reads: the mount, and the one the save invalidated. Nothing
    // waited out a poll interval, and nothing read the table once per key.
    expect(fetchMock.mock.calls.filter(([u]) => String(u) === '/api/config')).toHaveLength(2)
  })

  it('shows a saved custom theme immediately', async () => {
    const fetchMock = stubConfig({ 'theme.active': 'forest' })
    const { result } = renderHook(() => useTheme(), { wrapper: wrapperFor(newClient()) })
    await waitFor(() => expect(result.current.activeTheme.id).toBe('forest'))
    expect(result.current.customThemes).toEqual([])

    await act(async () => {
      await result.current.savePalette({ themes: [CUSTOM] })
    })

    await waitFor(() => expect(result.current.customThemes).toEqual([CUSTOM]))
    expect(result.current.allThemes.map((t) => t.id)).toContain('kitchen-night')
    expect(fetchMock.mock.calls.filter(([u]) => String(u) === '/api/config')).toHaveLength(2)
  })

  it('writes both keys in one mutation, so one click refetches the config once', async () => {
    // Creating a theme (and deleting one) changes the custom list *and* the
    // active id from a single click. Two mutations would invalidate the
    // shared config query twice and re-read the whole table twice for it.
    const fetchMock = stubConfig({ 'theme.active': 'forest' })
    const { result } = renderHook(() => useTheme(), { wrapper: wrapperFor(newClient()) })
    await waitFor(() => expect(result.current.activeTheme.id).toBe('forest'))

    await act(async () => {
      await result.current.savePalette({ themes: [CUSTOM], activeId: CUSTOM.id })
    })

    await waitFor(() => expect(result.current.activeTheme.id).toBe('kitchen-night'))
    expect(result.current.customThemes).toEqual([CUSTOM])
    expect(fetchMock.mock.calls.filter(([u]) => String(u) === '/api/config')).toHaveLength(2)
  })

  it('rolls the optimistic seed back and rejects when the write fails', async () => {
    // Nothing is invalidated on a failed write, so an un-rolled-back seed
    // would leave the whole dashboard painted in a palette the server
    // rejected until the next poll corrected it up to a minute later — and
    // the rejection has to reach `ThemeSettings`, which is the only thing
    // that can say so.
    stubConfig({ 'theme.active': 'forest' })
    const client = newClient()
    const { result } = renderHook(() => useTheme(), { wrapper: wrapperFor(client) })
    await waitFor(() => expect(result.current.activeTheme.id).toBe('forest'))

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url === '/api/config') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ 'theme.active': 'forest' }),
          } as Response)
        }
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })
      }),
    )

    await act(async () => {
      await expect(result.current.savePalette({ activeId: 'ocean' })).rejects.toThrow()
    })

    expect(client.getQueryData(CONFIG_QUERY_KEY)).toMatchObject({ 'theme.active': 'forest' })
    expect(result.current.activeTheme.id).toBe('forest')
  })

  it('keeps the switch after the invalidated re-read lands', async () => {
    // The optimistic `setQueryData` and the refetch the save provokes are two
    // different reasons the new value could be on screen. This proves it is
    // still there once the server's own copy has come back and replaced the
    // optimistic one — i.e. that the write was really persisted and really
    // re-read, not just painted locally.
    const fetchMock = stubConfig({ 'theme.active': 'forest' })
    const client = newClient()
    const { result } = renderHook(() => useTheme(), { wrapper: wrapperFor(client) })
    await waitFor(() => expect(result.current.activeTheme.id).toBe('forest'))

    await act(async () => {
      await result.current.savePalette({ activeId: 'ocean' })
    })
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([u]) => String(u) === '/api/config')).toHaveLength(2),
    )

    await waitFor(() => expect(result.current.activeTheme.id).toBe('ocean'))
  })
})

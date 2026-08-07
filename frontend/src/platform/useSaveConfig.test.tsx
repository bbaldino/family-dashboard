import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, renderHook, screen, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAllConfig } from './useAllConfig'
import { useSaveConfig } from './useSaveConfig'

/**
 * A real observer of the shared config query, not a peek at the cache.
 *
 * react-query notifies observers a tick *after* `invalidateQueries`, so a
 * test that reads `getQueryData` (or asserts straight after `mutateAsync`
 * resolves) passes against an implementation that never invalidates at all —
 * the value it sees is the one the mutation's own caller already had.
 * Rendering a consumer and waiting for its text means the assertion can only
 * pass once a refetch has actually reached a component.
 */
function Probe() {
  const { data } = useAllConfig()
  return <div data-testid="probe">{data?.['alpha.token'] ?? 'none'}</div>
}

function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

/** Mounts the probe and the mutation against one shared client — two trees,
 *  but the cache they invalidate and read lives on the client, not the
 *  provider. */
function setup(client: QueryClient) {
  const wrapper = wrapperFor(client)
  render(<Probe />, { wrapper })
  return renderHook(() => useSaveConfig(), { wrapper }).result
}

describe('useSaveConfig', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let config: Record<string, string>

  function configGets() {
    return fetchMock.mock.calls.filter(([u]) => String(u) === '/api/config')
  }
  function writes() {
    return fetchMock.mock.calls.filter(([u]) => String(u).startsWith('/api/config/'))
  }

  beforeEach(() => {
    config = { 'alpha.token': 'before' }
    fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/config') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ...config }) } as Response)
      }
      if (url.startsWith('/api/config/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
        } as Response)
      }
      return Promise.reject(new Error(`Unexpected fetch url: ${url}`))
    })
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sends the key as a PUT in the shape the config API takes', async () => {
    const result = setup(newClient())
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('before'))

    await act(async () => {
      await result.current.mutateAsync({ key: 'alpha.token', value: 'after' })
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/config/alpha.token', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'after' }),
    })
  })

  it('reaches a live consumer of the shared query without waiting out the poll', async () => {
    // The whole point of the task. Real timers, and the assertion lands in
    // milliseconds — the 60s `refetchInterval` cannot be what refreshed this.
    const result = setup(newClient())
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('before'))

    config = { 'alpha.token': 'after' }
    await act(async () => {
      await result.current.mutateAsync({ key: 'alpha.token', value: 'after' })
    })

    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('after'))
    // Once at mount, once because the save invalidated. No third read.
    expect(configGets()).toHaveLength(2)
  })

  it('refetches config once for a multi-key save, not once per key', async () => {
    // Invisible in a browser and the reason the mutation takes a batch: five
    // keys off one Save button must not pull the whole config table five
    // times.
    const result = setup(newClient())
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('before'))
    expect(configGets()).toHaveLength(1)

    config = { 'alpha.token': 'after' }
    await act(async () => {
      await result.current.mutateAsync([
        { key: 'alpha.token', value: 'after' },
        { key: 'alpha.one', value: '1' },
        { key: 'alpha.two', value: '2' },
        { key: 'alpha.three', value: '3' },
      ])
    })

    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('after'))
    expect(writes()).toHaveLength(4)
    expect(configGets()).toHaveLength(2)
  })

  it('deletes the key when the value is null', async () => {
    const result = setup(newClient())
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('before'))

    await act(async () => {
      await result.current.mutateAsync({ key: 'alpha.token', value: null })
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/config/alpha.token', { method: 'DELETE' })
  })

  it('rejects on a non-ok response and leaves the cache alone', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/config') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ...config }) } as Response)
      }
      return Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      } as Response)
    })
    const result = setup(newClient())
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('before'))

    await act(async () => {
      await expect(
        result.current.mutateAsync({ key: 'alpha.token', value: 'after' }),
      ).rejects.toThrow(/500/)
    })

    // A write that did not happen must not provoke a refetch: the cache still
    // matches the server.
    expect(configGets()).toHaveLength(1)
  })

  it('stops at the first failed write in a batch', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/config') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ...config }) } as Response)
      }
      if (url === '/api/config/alpha.two') {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({}),
        } as Response)
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response)
    })
    const result = setup(newClient())
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('before'))

    await act(async () => {
      await expect(
        result.current.mutateAsync([
          { key: 'alpha.one', value: '1' },
          { key: 'alpha.two', value: '2' },
          { key: 'alpha.three', value: '3' },
        ]),
      ).rejects.toThrow(/500/)
    })

    expect(writes().map(([u]) => String(u))).toEqual([
      '/api/config/alpha.one',
      '/api/config/alpha.two',
    ])
  })
})

import { describe, expect, it, vi, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useModels } from './useModels'

/**
 * The models list behind `ModelSelect`. Pins the route and the unwrapping of
 * `{ models: [{ name }] }` to plain names, plus the `HTTP <status>` error text
 * the settings form renders verbatim ("Could not load models: HTTP 500").
 */

function mockFetch(response: { ok: boolean; status?: number; body?: unknown }) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/llm/models') {
      return Promise.resolve({
        ok: response.ok,
        status: response.status ?? 200,
        json: () => Promise.resolve(response.body),
      } as Response)
    }
    return Promise.reject(new Error(`Unexpected fetch url: ${url}`))
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useModels', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches /api/llm/models and returns just the names', async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: { models: [{ name: 'llama3.2' }, { name: 'qwen2.5' }] },
    })

    const { result } = renderHook(() => useModels(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.data).toEqual(['llama3.2', 'qwen2.5']))
    expect(fetchMock).toHaveBeenCalledWith('/api/llm/models')
  })

  it('reports the HTTP status when the service is unreachable', async () => {
    mockFetch({ ok: false, status: 500 })

    const { result } = renderHook(() => useModels(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe('HTTP 500')
  })
})

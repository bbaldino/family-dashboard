import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useChores } from './useChores'
import type { TodayResponse } from './types'

const get = vi.hoisted(() => vi.fn())
const post = vi.hoisted(() => vi.fn())
vi.mock('./config', () => ({ choresIntegration: { api: { get, post } } }))

function today(): TodayResponse {
  return {
    completed_count: 1,
    total_count: 2,
    persons: [
      {
        person: { id: 1, name: 'Ben', color: '#000', avatar: null },
        assignments: [
          {
            id: 10,
            chore: { id: 100, name: 'Dishes', chore_type: 'regular', tags: [] },
            picked_chore: null,
            completed: false,
          },
          {
            id: 11,
            chore: { id: 101, name: 'Trash', chore_type: 'regular', tags: [] },
            picked_chore: null,
            completed: true,
          },
        ],
      },
    ],
  }
}

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useChores(), { wrapper })
  return { client, result }
}

function cached(client: QueryClient) {
  return client.getQueryData<TodayResponse>(['chores', 'today'])
}

describe('useChores optimistic toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    get.mockResolvedValue(today())
  })

  it('flips the assignment in the cache before the request resolves', async () => {
    const { client, result } = setup()
    await waitFor(() => expect(cached(client)).toBeDefined())

    let release: () => void = () => {}
    post.mockReturnValue(new Promise<void>((r) => (release = () => r())))

    act(() => {
      void result.current.uncompleteAssignment(11)
    })

    // Asserted while the POST is still in flight — this is the whole point.
    const assignments = cached(client)!.persons[0].assignments
    expect(assignments.find((a) => a.id === 11)!.completed).toBe(false)
    expect(cached(client)!.completed_count).toBe(0)

    await act(async () => {
      release()
    })
  })

  it('increments completed_count optimistically when completing', async () => {
    const { client, result } = setup()
    await waitFor(() => expect(cached(client)).toBeDefined())

    // Must be asserted mid-flight: the `refetch()` that follows a successful
    // POST restores the fixture, so awaiting first would assert the server's
    // count rather than the optimistic one.
    let release: () => void = () => {}
    post.mockReturnValue(new Promise<void>((r) => (release = () => r())))

    act(() => {
      void result.current.completeAssignment(10)
    })

    const assignments = cached(client)!.persons[0].assignments
    expect(assignments.find((a) => a.id === 10)!.completed).toBe(true)
    expect(cached(client)!.completed_count).toBe(2)
    expect(post).toHaveBeenCalledWith('/assignments/10/complete', {})

    await act(async () => {
      release()
    })
  })

  it('reverts the flip when the request fails', async () => {
    const { client, result } = setup()
    await waitFor(() => expect(cached(client)).toBeDefined())
    post.mockRejectedValue(new Error('boom'))

    await act(async () => {
      await result.current.uncompleteAssignment(11)
    })

    const assignments = cached(client)!.persons[0].assignments
    expect(assignments.find((a) => a.id === 11)!.completed).toBe(true)
    expect(cached(client)!.completed_count).toBe(1)
  })

  it('does not reject, so an un-awaited tap cannot become an unhandled rejection', async () => {
    const { result } = setup()
    post.mockRejectedValue(new Error('boom'))
    await expect(result.current.uncompleteAssignment(11)).resolves.toBeUndefined()
  })
})

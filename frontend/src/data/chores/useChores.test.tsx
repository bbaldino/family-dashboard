import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { flipCompleted, useChores } from './useChores'
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
    // `cancelQueries` delays the flip by a microtask, so wait for it rather
    // than asserting immediately after `act`.
    await waitFor(() => {
      const assignments = cached(client)!.persons[0].assignments
      expect(assignments.find((a) => a.id === 11)!.completed).toBe(false)
    })
    expect(cached(client)!.completed_count).toBe(0)
    expect(post).toHaveBeenCalledWith('/assignments/11/uncomplete', {})

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

    await waitFor(() => {
      const assignments = cached(client)!.persons[0].assignments
      expect(assignments.find((a) => a.id === 10)!.completed).toBe(true)
    })
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

  it('reverting a failed flip does not clobber an unrelated flip made in the meantime', async () => {
    const { client, result } = setup()
    await waitFor(() => expect(cached(client)).toBeDefined())

    // Two independent, manually-released POSTs: A (assignment 10) will hang
    // and then fail; B (assignment 11) will hang and stay unresolved for the
    // whole test — what matters is only that both are in flight when A fails.
    let releaseA: () => void = () => {}
    let releaseB: () => void = () => {}
    post.mockImplementation((url: string) => {
      if (url === '/assignments/10/complete') {
        return new Promise<void>((_resolve, reject) => {
          releaseA = () => reject(new Error('boom'))
        })
      }
      return new Promise<void>((resolve) => {
        releaseB = () => resolve()
      })
    })

    // Tap A.
    act(() => {
      void result.current.completeAssignment(10)
    })
    await waitFor(() => {
      const assignments = cached(client)!.persons[0].assignments
      expect(assignments.find((a) => a.id === 10)!.completed).toBe(true)
    })

    // Tap B while A is still in flight.
    act(() => {
      void result.current.uncompleteAssignment(11)
    })
    await waitFor(() => {
      const assignments = cached(client)!.persons[0].assignments
      expect(assignments.find((a) => a.id === 11)!.completed).toBe(false)
    })

    // A fails. A snapshot-based revert would restore the whole response
    // captured before A's own flip — before B's flip even existed — wiping
    // B's still-in-flight change out too. The surgical revert must only
    // touch A.
    releaseA()
    await waitFor(() => {
      const assignments = cached(client)!.persons[0].assignments
      expect(assignments.find((a) => a.id === 10)!.completed).toBe(false)
    })
    expect(cached(client)!.persons[0].assignments.find((a) => a.id === 11)!.completed).toBe(false)

    // Let B settle too so nothing is left dangling past the test.
    await act(async () => {
      releaseB()
    })
  })

  it('does not reject, so an un-awaited tap cannot become an unhandled rejection', async () => {
    const { client, result } = setup()
    await waitFor(() => expect(cached(client)).toBeDefined())
    post.mockRejectedValue(new Error('boom'))
    await expect(result.current.uncompleteAssignment(11)).resolves.toBeUndefined()
  })
})

describe('flipCompleted', () => {
  it('returns the identical reference when the assignment is absent', () => {
    const data = today()
    expect(flipCompleted(data, 999, true)).toBe(data)
  })

  it('returns the identical reference when the assignment is already in the requested state', () => {
    const data = today()
    // Assignment 11 starts `completed: true` — asking for `true` again must
    // be a no-op, or `completed_count` would drift on a redundant call.
    expect(flipCompleted(data, 11, true)).toBe(data)
  })
})

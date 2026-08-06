import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TODAY_KEY } from './useChores'
import {
  CHORE_LIST_KEY,
  PEOPLE_KEY,
  assignmentsKey,
  useAssignments,
  useChoreList,
  useCopyWeek,
  useCreateAssignment,
  useCreateChore,
  useDeleteAssignment,
  useDeleteChore,
  useDeletePerson,
  usePeople,
  useRotateWeek,
  useSavePerson,
  useUpdateChore,
} from './useChoreAdmin'
import type { AssignmentResponse, Chore, Person } from './types'

/**
 * Two things are pinned here.
 *
 * First, the composed request of every admin read and write — full URL,
 * method and JSON body — copied from what `admin/chore-admin/` sends today.
 * These hooks exist to take those calls over verbatim, so a changed path or a
 * renamed body field is a regression, not a refactor.
 *
 * Second, and the reason this file matters more than the shape assertions:
 * every write invalidates the dashboard's today view, not just the admin-side
 * list it obviously touches. Admin and the wall display read the same rows
 * through different endpoints. A chore renamed in admin that only invalidates
 * `['chores', 'list']` leaves the kitchen tablet showing the old name until
 * its next 60s poll — a bug that is invisible in the admin browser tab,
 * because that tab updates correctly.
 */

const PEOPLE: Person[] = [
  { id: 1, name: 'Ben', color: '#e88a6a', avatar: null },
  { id: 2, name: 'Sam', color: '#6a9ee8', avatar: 'ben.png' },
]

const CHORES: Chore[] = [
  {
    id: 100,
    name: 'Dishes',
    description: 'After dinner',
    chore_type: 'regular',
    tags: ['kitchen'],
    pick_from_tags: [],
  },
]

const ASSIGNMENTS: AssignmentResponse[] = [
  {
    id: 10,
    chore: { id: 100, name: 'Dishes', chore_type: 'regular', tags: ['kitchen'] },
    person: { id: 1, name: 'Ben', color: '#e88a6a', avatar: null },
    week_of: '2026-08-03',
    day_of_week: 0,
    picked_chore: null,
    completed: false,
  },
]

const WEEK = '2026-08-03'

interface Call {
  url: string
  method: string
  body: unknown
}

let calls: Call[] = []

function responseFor(url: string): unknown {
  if (url.startsWith('/api/chores/people')) return PEOPLE
  if (url.startsWith('/api/chores/chores')) return CHORES
  if (url.startsWith('/api/chores/assignments')) return ASSIGNMENTS
  return {}
}

/** Multipart bodies decode to a plain object, a File to its filename, so a
 *  form write can be asserted the same way a JSON one is. */
function readBody(body: BodyInit | null | undefined): unknown {
  if (body === undefined || body === null) return undefined
  if (!(body instanceof FormData)) return JSON.parse(String(body))
  const out: Record<string, unknown> = {}
  body.forEach((value, key) => {
    out[key] = value instanceof File ? value.name : value
  })
  return out
}

function mockFetch(ok = true) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({
      url,
      method: init?.method ?? 'GET',
      body: readBody(init?.body),
    })
    const body = ok ? responseFor(url) : { error: 'boom' }
    return Promise.resolve({
      ok,
      status: ok ? 200 : 500,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response)
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function setup<T>(hook: () => T, queryClient = newClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(hook, { wrapper })
  return { result, queryClient }
}

/** Populate every cache entry a write could plausibly touch, so "was it
 *  invalidated?" is a real question rather than "does the entry exist?". */
function seedCaches(queryClient: QueryClient) {
  queryClient.setQueryData(TODAY_KEY, { persons: [], completed_count: 0, total_count: 0 })
  queryClient.setQueryData(PEOPLE_KEY, PEOPLE)
  queryClient.setQueryData(CHORE_LIST_KEY, CHORES)
  queryClient.setQueryData(assignmentsKey(WEEK), ASSIGNMENTS)
}

function isInvalidated(queryClient: QueryClient, key: readonly unknown[]) {
  return queryClient.getQueryState(key)?.isInvalidated ?? false
}

beforeEach(() => {
  calls = []
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('people', () => {
  it('reads the roster from GET /api/chores/people', async () => {
    mockFetch()
    const { result } = setup(() => usePeople())

    await waitFor(() => expect(result.current.data).toEqual(PEOPLE))
    expect(calls).toEqual([{ url: '/api/chores/people', method: 'GET', body: undefined }])
  })

  it('creates with a multipart POST /api/chores/people', async () => {
    mockFetch()
    const { result } = setup(() => useSavePerson())

    await result.current.mutateAsync({
      id: null,
      input: { name: 'Kai', color: '#e88a6a', avatar: null },
    })

    expect(calls).toEqual([
      { url: '/api/chores/people', method: 'POST', body: { name: 'Kai', color: '#e88a6a' } },
    ])
  })

  it('updates with a multipart PUT /api/chores/people/{id}', async () => {
    mockFetch()
    const { result } = setup(() => useSavePerson())

    await result.current.mutateAsync({
      id: 1,
      input: { name: 'Ben', color: '#6a9aba', avatar: null },
    })

    expect(calls).toEqual([
      { url: '/api/chores/people/1', method: 'PUT', body: { name: 'Ben', color: '#6a9aba' } },
    ])
  })

  it('appends the avatar file only when one was picked', async () => {
    mockFetch()
    const { result } = setup(() => useSavePerson())

    await result.current.mutateAsync({
      id: null,
      input: {
        name: 'Kai',
        color: '#e88a6a',
        avatar: new File(['bytes'], 'kai.png', { type: 'image/png' }),
      },
    })

    expect(calls[0].body).toEqual({ name: 'Kai', color: '#e88a6a', avatar: 'kai.png' })
  })

  it('invalidates the roster, the week and the dashboard after a save', async () => {
    mockFetch()
    const queryClient = newClient()
    seedCaches(queryClient)
    const { result } = setup(() => useSavePerson(), queryClient)

    await result.current.mutateAsync({
      id: 1,
      input: { name: 'Benjamin', color: '#e88a6a', avatar: null },
    })

    expect(isInvalidated(queryClient, PEOPLE_KEY)).toBe(true)
    // A renamed person is embedded in every assignment, grid and wall alike.
    expect(isInvalidated(queryClient, assignmentsKey(WEEK))).toBe(true)
    expect(isInvalidated(queryClient, TODAY_KEY)).toBe(true)
  })

  it('surfaces a failed save to the caller', async () => {
    mockFetch(false)
    const { result } = setup(() => useSavePerson())

    await expect(
      result.current.mutateAsync({
        id: null,
        input: { name: 'Kai', color: '#e88a6a', avatar: null },
      }),
    ).rejects.toThrow('boom')
  })

  it('deletes with DELETE /api/chores/people/{id}', async () => {
    mockFetch()
    const { result } = setup(() => useDeletePerson())

    await result.current.mutateAsync(2)

    expect(calls).toEqual([{ url: '/api/chores/people/2', method: 'DELETE', body: undefined }])
  })

  it('surfaces a failed delete to the caller', async () => {
    mockFetch(false)
    const { result } = setup(() => useDeletePerson())

    await expect(result.current.mutateAsync(2)).rejects.toThrow('boom')
  })

  it('invalidates the roster, the week and the dashboard after a delete', async () => {
    mockFetch()
    const queryClient = newClient()
    seedCaches(queryClient)
    const { result } = setup(() => useDeletePerson(), queryClient)

    await result.current.mutateAsync(2)

    expect(isInvalidated(queryClient, PEOPLE_KEY)).toBe(true)
    expect(isInvalidated(queryClient, assignmentsKey(WEEK))).toBe(true)
    // A deleted person's assignments vanish from the wall display too.
    expect(isInvalidated(queryClient, TODAY_KEY)).toBe(true)
  })
})

describe('chores', () => {
  const input = {
    name: 'Sweep',
    description: null,
    chore_type: 'regular' as const,
    tags: ['floor'],
    pick_from_tags: [],
  }

  it('reads the catalog from GET /api/chores/chores', async () => {
    mockFetch()
    const { result } = setup(() => useChoreList())

    await waitFor(() => expect(result.current.data).toEqual(CHORES))
    expect(calls).toEqual([{ url: '/api/chores/chores', method: 'GET', body: undefined }])
  })

  it('creates with POST /api/chores/chores and the form body', async () => {
    mockFetch()
    const { result } = setup(() => useCreateChore())

    await result.current.mutateAsync(input)

    expect(calls).toEqual([{ url: '/api/chores/chores', method: 'POST', body: input }])
  })

  it('updates with PUT /api/chores/chores/{id} and the same body shape', async () => {
    mockFetch()
    const { result } = setup(() => useUpdateChore())

    await result.current.mutateAsync({ id: 100, body: input })

    expect(calls).toEqual([{ url: '/api/chores/chores/100', method: 'PUT', body: input }])
  })

  it('deletes with DELETE /api/chores/chores/{id}', async () => {
    mockFetch()
    const { result } = setup(() => useDeleteChore())

    await result.current.mutateAsync(100)

    expect(calls).toEqual([{ url: '/api/chores/chores/100', method: 'DELETE', body: undefined }])
  })

  it('invalidates the catalog, the week and the dashboard after a create', async () => {
    mockFetch()
    const queryClient = newClient()
    seedCaches(queryClient)
    const { result } = setup(() => useCreateChore(), queryClient)

    await result.current.mutateAsync(input)

    expect(isInvalidated(queryClient, CHORE_LIST_KEY)).toBe(true)
    expect(isInvalidated(queryClient, assignmentsKey(WEEK))).toBe(true)
    expect(isInvalidated(queryClient, TODAY_KEY)).toBe(true)
  })

  it('invalidates the catalog, the week and the dashboard after an update', async () => {
    mockFetch()
    const queryClient = newClient()
    seedCaches(queryClient)
    const { result } = setup(() => useUpdateChore(), queryClient)

    await result.current.mutateAsync({ id: 100, body: input })

    expect(isInvalidated(queryClient, CHORE_LIST_KEY)).toBe(true)
    // A renamed chore is embedded in every assignment it appears in.
    expect(isInvalidated(queryClient, assignmentsKey(WEEK))).toBe(true)
    expect(isInvalidated(queryClient, TODAY_KEY)).toBe(true)
  })

  it('invalidates the dashboard after a delete', async () => {
    mockFetch()
    const queryClient = newClient()
    seedCaches(queryClient)
    const { result } = setup(() => useDeleteChore(), queryClient)

    await result.current.mutateAsync(100)

    expect(isInvalidated(queryClient, CHORE_LIST_KEY)).toBe(true)
    expect(isInvalidated(queryClient, TODAY_KEY)).toBe(true)
  })
})

describe('assignments', () => {
  it('reads one week from GET /api/chores/assignments?week=', async () => {
    mockFetch()
    const { result } = setup(() => useAssignments(WEEK))

    await waitFor(() => expect(result.current.data).toEqual(ASSIGNMENTS))
    expect(calls).toEqual([
      { url: '/api/chores/assignments?week=2026-08-03', method: 'GET', body: undefined },
    ])
  })

  it('keys each week separately, so paging back and forth does not thrash', async () => {
    mockFetch()
    const queryClient = newClient()
    const { result, rerender } = renderHook(({ week }: { week: string }) => useAssignments(week), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
      initialProps: { week: WEEK },
    })
    await waitFor(() => expect(result.current.data).toEqual(ASSIGNMENTS))

    rerender({ week: '2026-07-27' })
    await waitFor(() => expect(result.current.data).toEqual(ASSIGNMENTS))

    expect(calls.map((c) => c.url)).toEqual([
      '/api/chores/assignments?week=2026-08-03',
      '/api/chores/assignments?week=2026-07-27',
    ])
    expect(queryClient.getQueryData(assignmentsKey(WEEK))).toEqual(ASSIGNMENTS)
  })

  it('creates with POST /api/chores/assignments and the drop body', async () => {
    mockFetch()
    const { result } = setup(() => useCreateAssignment())

    await result.current.mutateAsync({
      chore_id: 100,
      person_id: 1,
      week_of: WEEK,
      day_of_week: 3,
    })

    expect(calls).toEqual([
      {
        url: '/api/chores/assignments',
        method: 'POST',
        body: { chore_id: 100, person_id: 1, week_of: WEEK, day_of_week: 3 },
      },
    ])
  })

  it('deletes with DELETE /api/chores/assignments/{id}', async () => {
    mockFetch()
    const { result } = setup(() => useDeleteAssignment())

    await result.current.mutateAsync(10)

    expect(calls).toEqual([
      { url: '/api/chores/assignments/10', method: 'DELETE', body: undefined },
    ])
  })

  it('invalidates the week and the dashboard after a create', async () => {
    mockFetch()
    const queryClient = newClient()
    seedCaches(queryClient)
    const { result } = setup(() => useCreateAssignment(), queryClient)

    await result.current.mutateAsync({
      chore_id: 100,
      person_id: 1,
      week_of: WEEK,
      day_of_week: 3,
    })

    expect(isInvalidated(queryClient, assignmentsKey(WEEK))).toBe(true)
    expect(isInvalidated(queryClient, TODAY_KEY)).toBe(true)
  })

  it('invalidates the dashboard after a delete', async () => {
    mockFetch()
    const queryClient = newClient()
    seedCaches(queryClient)
    const { result } = setup(() => useDeleteAssignment(), queryClient)

    await result.current.mutateAsync(10)

    expect(isInvalidated(queryClient, assignmentsKey(WEEK))).toBe(true)
    expect(isInvalidated(queryClient, TODAY_KEY)).toBe(true)
  })
})

describe('weeks', () => {
  it('copies with POST /api/chores/weeks/copy and from_week/to_week', async () => {
    mockFetch()
    const { result } = setup(() => useCopyWeek())

    await result.current.mutateAsync({ from_week: '2026-07-27', to_week: WEEK })

    expect(calls).toEqual([
      {
        url: '/api/chores/weeks/copy',
        method: 'POST',
        body: { from_week: '2026-07-27', to_week: WEEK },
      },
    ])
  })

  it('rotates with POST /api/chores/weeks/rotate and { week }', async () => {
    mockFetch()
    const { result } = setup(() => useRotateWeek())

    await result.current.mutateAsync(WEEK)

    expect(calls).toEqual([
      { url: '/api/chores/weeks/rotate', method: 'POST', body: { week: WEEK } },
    ])
  })

  it('invalidates the week and the dashboard after a copy', async () => {
    mockFetch()
    const queryClient = newClient()
    seedCaches(queryClient)
    const { result } = setup(() => useCopyWeek(), queryClient)

    await result.current.mutateAsync({ from_week: '2026-07-27', to_week: WEEK })

    expect(isInvalidated(queryClient, assignmentsKey(WEEK))).toBe(true)
    expect(isInvalidated(queryClient, TODAY_KEY)).toBe(true)
  })

  it('invalidates the week and the dashboard after a rotate', async () => {
    mockFetch()
    const queryClient = newClient()
    seedCaches(queryClient)
    const { result } = setup(() => useRotateWeek(), queryClient)

    await result.current.mutateAsync(WEEK)

    expect(isInvalidated(queryClient, assignmentsKey(WEEK))).toBe(true)
    expect(isInvalidated(queryClient, TODAY_KEY)).toBe(true)
  })
})

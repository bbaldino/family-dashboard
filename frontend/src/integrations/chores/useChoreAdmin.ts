import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { choresIntegration } from './config'
import { TODAY_KEY } from './useChores'
import type { AssignmentResponse, Chore, Person } from './types'

/**
 * The reads and writes the chore-admin screens need, as hooks the integration
 * owns. `api` prefixes `/api/chores` and is only reachable from inside this
 * directory; admin gets these instead of composing paths of its own.
 *
 * Requests here are the ones `admin/chore-admin/` already sends — same paths,
 * same methods, same bodies. What is new is the cache handling below.
 */

export const PEOPLE_KEY = ['chores', 'people'] as const
export const CHORE_LIST_KEY = ['chores', 'list'] as const

/** One cache entry per week, so paging back and forth doesn't refetch. */
export const assignmentsKey = (weekStr: string) => ['chores', 'assignments', weekStr] as const

/** Every week at once — a write to one week can't know which weeks are cached. */
const ASSIGNMENTS_PREFIX = ['chores', 'assignments'] as const

/**
 * Invalidate the admin-side entries a write obviously touches **and** the wall
 * dashboard's today view.
 *
 * That second part is the point. Admin and the dashboard read the same rows
 * through different endpoints (`/chores`, `/assignments` vs `/today`), so a
 * chore renamed or a person deleted here is invisible to `TODAY_KEY` unless it
 * is named explicitly. Skip it and the admin tab updates correctly while the
 * kitchen tablet keeps showing the old data for up to a minute — a bug you
 * cannot see from the browser you just made the edit in.
 */
function invalidate(queryClient: QueryClient, keys: readonly (readonly unknown[])[]) {
  return Promise.all(
    [...keys, TODAY_KEY].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  )
}

// ---------------------------------------------------------------- people

export function usePeople() {
  return useQuery({
    queryKey: PEOPLE_KEY,
    queryFn: () => choresIntegration.api.get<Person[]>('/people'),
  })
}

/** The person form's payload. `avatar` is the newly picked file, or `null`
 *  when the existing image (or lack of one) is being kept. */
export interface PersonInput {
  name: string
  color: string
  avatar: File | null
}

/**
 * Create (`id: null`) or update a person.
 *
 * Multipart rather than JSON, because the avatar is a file — this is the one
 * write in the integration that `post`/`put` cannot carry. A name or colour
 * change shows on the week grids and the wall display as well as the roster,
 * since assignments embed the person they belong to.
 */
export function useSavePerson() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number | null; input: PersonInput }) => {
      const form = new FormData()
      form.append('name', input.name)
      form.append('color', input.color)
      if (input.avatar) form.append('avatar', input.avatar)
      return id === null
        ? choresIntegration.api.postForm<Person>('/people', form)
        : choresIntegration.api.putForm<Person>('/people/' + id, form)
    },
    onSuccess: () => invalidate(queryClient, [PEOPLE_KEY, ASSIGNMENTS_PREFIX]),
  })
}

/**
 * Removing a person takes their assignments with them, so the week grids and
 * the dashboard both change — not just the roster.
 */
export function useDeletePerson() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => choresIntegration.api.del('/people/' + id),
    onSuccess: () => invalidate(queryClient, [PEOPLE_KEY, ASSIGNMENTS_PREFIX]),
  })
}

// ---------------------------------------------------------------- chores

/** The chore form's payload. `pick_from_tags` is only meaningful for a meta
 *  chore; the form sends `[]` for a regular one rather than omitting it. */
export interface ChoreInput {
  name: string
  description: string | null
  chore_type: 'regular' | 'meta'
  tags: string[]
  pick_from_tags: string[]
}

/** The chore catalog — the definitions the admin tab edits, distinct from
 *  `useChores`, which is a day's assignments for the wall display. */
export function useChoreList() {
  return useQuery({
    queryKey: CHORE_LIST_KEY,
    queryFn: () => choresIntegration.api.get<Chore[]>('/chores'),
  })
}

export function useCreateChore() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ChoreInput) => choresIntegration.api.post<Chore>('/chores', body),
    onSuccess: () => invalidate(queryClient, [CHORE_LIST_KEY, ASSIGNMENTS_PREFIX]),
  })
}

/**
 * Assignments embed a chore's name and tags rather than referencing them, so
 * an edit here restates both grids as well as the catalog.
 */
export function useUpdateChore() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: ChoreInput }) =>
      choresIntegration.api.put<Chore>('/chores/' + id, body),
    onSuccess: () => invalidate(queryClient, [CHORE_LIST_KEY, ASSIGNMENTS_PREFIX]),
  })
}

export function useDeleteChore() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => choresIntegration.api.del('/chores/' + id),
    onSuccess: () => invalidate(queryClient, [CHORE_LIST_KEY, ASSIGNMENTS_PREFIX]),
  })
}

// ----------------------------------------------------------- assignments

/** `weekStr` is a local `YYYY-MM-DD` Monday, as `toLocalDateStr(getMonday(…))`
 *  produces — the query string is composed here so no caller re-derives it. */
export function useAssignments(weekStr: string) {
  return useQuery({
    queryKey: assignmentsKey(weekStr),
    queryFn: () => choresIntegration.api.get<AssignmentResponse[]>(`/assignments?week=${weekStr}`),
  })
}

export interface NewAssignment {
  chore_id: number
  person_id: number
  week_of: string
  day_of_week: number
}

export function useCreateAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: NewAssignment) =>
      choresIntegration.api.post<AssignmentResponse>('/assignments', body),
    onSuccess: () => invalidate(queryClient, [ASSIGNMENTS_PREFIX]),
  })
}

export function useDeleteAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => choresIntegration.api.del('/assignments/' + id),
    onSuccess: () => invalidate(queryClient, [ASSIGNMENTS_PREFIX]),
  })
}

// ----------------------------------------------------------------- weeks

/**
 * Bulk-fill a week from the previous one. The backend loops bare INSERTs with
 * no transaction, so a partial copy is possible — a known Rust bug tracked
 * separately, deliberately not worked around here. Invalidating both grids on
 * success at least makes whatever landed visible immediately.
 */
export function useCopyWeek() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { from_week: string; to_week: string }) =>
      choresIntegration.api.post('/weeks/copy', body),
    onSuccess: () => invalidate(queryClient, [ASSIGNMENTS_PREFIX]),
  })
}

/** Shift a week's chores round the household. Same non-transactional backend
 *  caveat as `useCopyWeek`. */
export function useRotateWeek() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (weekStr: string) => choresIntegration.api.post('/weeks/rotate', { week: weekStr }),
    onSuccess: () => invalidate(queryClient, [ASSIGNMENTS_PREFIX]),
  })
}

import { vi } from 'vitest'
import type { AssignmentResponse, Chore, Person } from '@/integrations/chores'

/**
 * A stateful in-memory stand-in for the chores backend, shared by the three
 * chore-admin tab tests.
 *
 * Stateful rather than a per-URL lookup table on purpose. The tabs currently
 * apply a delete by filtering their own `useState` array and never re-reading,
 * so a fixed-response mock would let "the row disappeared" pass for a component
 * that never issued the request — and would then *fail* for any implementation
 * that re-reads after writing, even though the user-visible result is
 * identical. A fake that actually applies the write is neutral between the two,
 * which is what a characterization test needs.
 *
 * Records every call so tests can pin the composed request; bodies arrive
 * parsed, JSON or multipart alike.
 */

export interface RecordedCall {
  url: string
  method: string
  body: unknown
}

export interface ChoreServerOptions {
  people?: Person[]
  chores?: Chore[]
  assignments?: AssignmentResponse[]
  /** Requests this matches respond 500 with `{ error }`. */
  failWhen?: (url: string, method: string) => boolean
  /** The `error` field of a failed response — what the tabs surface verbatim. */
  error?: string
}

export interface ChoreServer {
  calls: RecordedCall[]
  people: Person[]
  chores: Chore[]
  assignments: AssignmentResponse[]
  /** Calls to one path+method, in order. */
  callsTo: (url: string, method?: string) => RecordedCall[]
}

/** Multipart bodies as a plain object; a File becomes its filename. */
function readFormData(body: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  body.forEach((value, key) => {
    out[key] = value instanceof File ? value.name : value
  })
  return out
}

function readBody(init?: RequestInit): unknown {
  if (init?.body === undefined || init.body === null) return undefined
  if (init.body instanceof FormData) return readFormData(init.body)
  return JSON.parse(String(init.body))
}

export function startChoreServer(options: ChoreServerOptions = {}): ChoreServer {
  const state: ChoreServer = {
    calls: [],
    people: [...(options.people ?? [])],
    chores: [...(options.chores ?? [])],
    assignments: [...(options.assignments ?? [])],
    callsTo: (url, method) =>
      state.calls.filter((c) => c.url === url && (method === undefined || c.method === method)),
  }
  const errorMessage = options.error ?? 'boom'
  let nextId = 900

  function respond(value: unknown, status = 200): Promise<Response> {
    const text = status === 204 ? '' : JSON.stringify(value)
    return Promise.resolve({
      ok: status < 400,
      status,
      json: () => Promise.resolve(value),
      text: () => Promise.resolve(text),
    } as Response)
  }

  function route(url: string, method: string, body: unknown): Promise<Response> {
    // Non-chores endpoints AssignmentsTab touches on mount. Neither is this
    // plan's business; they just have to answer so the tab can render.
    if (url === '/api/config') return respond({})
    if (url.startsWith('/api/google-calendar/events')) return respond([])

    const path = url.replace('/api/chores', '')

    if (path === '/people' && method === 'GET') return respond(state.people)
    if (path === '/people' && method === 'POST') {
      const form = body as Record<string, string>
      const person: Person = {
        id: nextId++,
        name: form.name,
        color: form.color,
        avatar: form.avatar ?? null,
      }
      state.people.push(person)
      return respond(person)
    }
    const personMatch = /^\/people\/(\d+)$/.exec(path)
    if (personMatch) {
      const id = Number(personMatch[1])
      if (method === 'PUT') {
        const form = body as Record<string, string>
        state.people = state.people.map((p) =>
          p.id === id
            ? { ...p, name: form.name, color: form.color, avatar: form.avatar ?? p.avatar }
            : p,
        )
        return respond(state.people.find((p) => p.id === id))
      }
      if (method === 'DELETE') {
        state.people = state.people.filter((p) => p.id !== id)
        state.assignments = state.assignments.filter((a) => a.person.id !== id)
        return respond(undefined, 204)
      }
    }

    if (path === '/chores' && method === 'GET') return respond(state.chores)
    if (path === '/chores' && method === 'POST') {
      const chore = { id: nextId++, ...(body as object) } as Chore
      state.chores.push(chore)
      return respond(chore)
    }
    const choreMatch = /^\/chores\/(\d+)$/.exec(path)
    if (choreMatch) {
      const id = Number(choreMatch[1])
      if (method === 'PUT') {
        const updated = { id, ...(body as object) } as Chore
        state.chores = state.chores.map((c) => (c.id === id ? updated : c))
        return respond(updated)
      }
      if (method === 'DELETE') {
        state.chores = state.chores.filter((c) => c.id !== id)
        return respond(undefined, 204)
      }
    }

    if (path.startsWith('/assignments?week=') && method === 'GET') {
      const week = path.slice('/assignments?week='.length)
      return respond(state.assignments.filter((a) => a.week_of === week))
    }
    if (path === '/assignments' && method === 'POST') {
      const input = body as {
        chore_id: number
        person_id: number
        week_of: string
        day_of_week: number
      }
      const chore = state.chores.find((c) => c.id === input.chore_id)
      const person = state.people.find((p) => p.id === input.person_id)
      if (!chore || !person) return respond({ error: 'unknown chore or person' }, 400)
      const assignment: AssignmentResponse = {
        id: nextId++,
        chore: {
          id: chore.id,
          name: chore.name,
          chore_type: chore.chore_type,
          tags: chore.tags,
        },
        person,
        week_of: input.week_of,
        day_of_week: input.day_of_week,
        picked_chore: null,
        completed: false,
      }
      state.assignments.push(assignment)
      return respond(assignment)
    }
    const assignmentMatch = /^\/assignments\/(\d+)$/.exec(path)
    if (assignmentMatch && method === 'DELETE') {
      const id = Number(assignmentMatch[1])
      state.assignments = state.assignments.filter((a) => a.id !== id)
      return respond(undefined, 204)
    }

    if (path === '/weeks/copy' && method === 'POST') {
      const { from_week, to_week } = body as { from_week: string; to_week: string }
      const copied = state.assignments
        .filter((a) => a.week_of === from_week)
        .map((a) => ({ ...a, id: nextId++, week_of: to_week }))
      state.assignments.push(...copied)
      return respond({ copied: copied.length })
    }
    if (path === '/weeks/rotate' && method === 'POST') {
      const { week } = body as { week: string }
      state.assignments = state.assignments.map((a) => {
        if (a.week_of !== week) return a
        const idx = state.people.findIndex((p) => p.id === a.person.id)
        const next = state.people[(idx + 1) % state.people.length]
        return { ...a, person: next }
      })
      return respond({ rotated: true })
    }

    return Promise.reject(new Error(`Unexpected ${method} ${url}`))
  }

  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    const body = readBody(init)
    state.calls.push({ url, method, body })
    if (options.failWhen?.(url, method)) return respond({ error: errorMessage }, 500)
    return route(url, method, body)
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  return state
}

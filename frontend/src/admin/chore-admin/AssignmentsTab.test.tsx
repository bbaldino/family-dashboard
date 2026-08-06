import { describe, expect, it, afterEach, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AssignmentsTab } from './AssignmentsTab'
import { startChoreServer, type ChoreServer } from './choreServer'
import { toLocalDateStr } from '@/utils/date'
import type { AssignmentResponse, Chore, Person } from '@/integrations/chores'

/**
 * Characterization tests: what this tab does *today*, written against the
 * hand-rolled `useState` + `api` version before it moved onto the chores
 * integration's hooks.
 *
 * Everything here hangs off the week string. The grid, the week arrows, the
 * copy and the rotate all compose `YYYY-MM-DD` for a *local* Monday, and an
 * off-by-one there writes assignments into the wrong week — which looks like
 * nothing at all until someone opens the tablet on Monday morning. So the week
 * the tab asks for, and the week each write names, are pinned explicitly.
 *
 * Drag-and-drop assignment creation is not covered: @dnd-kit's pointer sensor
 * needs real coordinates and a real drag, which `fireEvent` cannot produce.
 * That path is browser-checked instead.
 */

function mondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

function shiftDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

const THIS_MONDAY = mondayOf(new Date())
const THIS_WEEK = toLocalDateStr(THIS_MONDAY)
const LAST_WEEK = toLocalDateStr(shiftDays(THIS_MONDAY, -7))
const NEXT_WEEK = toLocalDateStr(shiftDays(THIS_MONDAY, 7))

function weekHeading(monday: Date): string {
  return `Week of ${monday.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })}`
}

const PEOPLE: Person[] = [
  { id: 1, name: 'Ben', color: '#e88a6a', avatar: null },
  { id: 2, name: 'Sam', color: '#6a9aba', avatar: 'sam.png' },
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
  {
    id: 101,
    name: 'Trash',
    description: null,
    chore_type: 'regular',
    tags: ['weekly'],
    pick_from_tags: [],
  },
]

function assignment(id: number, choreIdx: number, week: string, day: number): AssignmentResponse {
  const chore = CHORES[choreIdx]
  return {
    id,
    chore: { id: chore.id, name: chore.name, chore_type: chore.chore_type, tags: chore.tags },
    person: PEOPLE[0],
    week_of: week,
    day_of_week: day,
    picked_chore: null,
    completed: false,
  }
}

/** This week has Dishes; last week has Trash. Each chore's name also appears
 *  once in the always-present chore pool, so a chip on the grid is the
 *  *second* occurrence — which is what these counts read. */
const ASSIGNMENTS: AssignmentResponse[] = [
  assignment(10, 0, THIS_WEEK, 0),
  assignment(11, 1, LAST_WEEK, 2),
]

function occurrences(name: string): number {
  return screen.queryAllByText(name).length
}

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function startServer(failWhen?: (url: string, method: string) => boolean): ChoreServer {
  return startChoreServer({
    people: PEOPLE,
    chores: CHORES,
    assignments: ASSIGNMENTS,
    failWhen,
  })
}

/** Renders and waits out the mount-time load of assignments, people and chores. */
async function renderLoaded(server: ChoreServer) {
  render(<AssignmentsTab />, { wrapper: Wrapper })
  expect(screen.getByText('Loading assignments...')).toBeInTheDocument()
  await screen.findByText(weekHeading(THIS_MONDAY))
  return server
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AssignmentsTab', () => {
  it("renders this week's grid, chips and chore pool", async () => {
    const server = startServer()
    await renderLoaded(server)

    expect(screen.getByText('Ben')).toBeInTheDocument()
    expect(screen.getByText('Sam')).toBeInTheDocument()
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Chore Pool')).toBeInTheDocument()
    // Dishes is assigned this week, so it shows twice: pool and grid chip.
    expect(occurrences('Dishes')).toBe(2)
    // Trash is only in last week, so this week it is pool-only.
    expect(occurrences('Trash')).toBe(1)
  })

  it("asks for the current week's assignments alongside people and chores", async () => {
    const server = startServer()
    await renderLoaded(server)

    expect(server.callsTo(`/api/chores/assignments?week=${THIS_WEEK}`, 'GET')).toHaveLength(1)
    expect(server.callsTo('/api/chores/people', 'GET')).toHaveLength(1)
    expect(server.callsTo('/api/chores/chores', 'GET')).toHaveLength(1)
  })

  it("shows a person's avatar from the per-person avatar route", async () => {
    const server = startServer()
    await renderLoaded(server)

    // Deliberately preserved: this route does not exist on the backend. A
    // known bug tracked separately, not this refactor's to change.
    expect(screen.getByRole('img', { name: 'Sam' })).toHaveAttribute(
      'src',
      '/api/chores/people/2/avatar',
    )
  })

  it('pages back and forward a week at a time', async () => {
    const server = startServer()
    await renderLoaded(server)

    fireEvent.click(screen.getByRole('button', { name: '<' }))

    await screen.findByText(weekHeading(shiftDays(THIS_MONDAY, -7)))
    await waitFor(() => expect(occurrences('Trash')).toBe(2))
    expect(occurrences('Dishes')).toBe(1)
    expect(server.callsTo(`/api/chores/assignments?week=${LAST_WEEK}`, 'GET')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: '>' }))
    await screen.findByText(weekHeading(THIS_MONDAY))
    fireEvent.click(screen.getByRole('button', { name: '>' }))

    await screen.findByText(weekHeading(shiftDays(THIS_MONDAY, 7)))
    await waitFor(() => expect(occurrences('Dishes')).toBe(1))
    expect(server.callsTo(`/api/chores/assignments?week=${NEXT_WEEK}`, 'GET')).toHaveLength(1)
  })

  it('removes an assignment when its chip is tapped', async () => {
    const server = startServer()
    await renderLoaded(server)

    fireEvent.click(screen.getByRole('button', { name: 'Dishes×' }))

    await waitFor(() => expect(occurrences('Dishes')).toBe(1))
    expect(server.callsTo('/api/chores/assignments/10', 'DELETE')).toHaveLength(1)
  })

  it("renders the server's message when removing an assignment fails", async () => {
    const server = startServer((_url, method) => method === 'DELETE')
    await renderLoaded(server)

    fireEvent.click(screen.getByRole('button', { name: 'Dishes×' }))

    expect(await screen.findByText('boom')).toBeInTheDocument()
    expect(occurrences('Dishes')).toBe(2)
  })

  it('copies last week into this one, naming both weeks', async () => {
    const server = startServer()
    await renderLoaded(server)

    fireEvent.click(screen.getByRole('button', { name: 'Copy from Last Week' }))

    await waitFor(() => expect(occurrences('Trash')).toBe(2))
    expect(server.callsTo('/api/chores/weeks/copy', 'POST')).toEqual([
      {
        url: '/api/chores/weeks/copy',
        method: 'POST',
        body: { from_week: LAST_WEEK, to_week: THIS_WEEK },
      },
    ])
  })

  it("renders the server's message when the copy fails", async () => {
    const server = startServer((url) => url.endsWith('/weeks/copy'))
    await renderLoaded(server)

    fireEvent.click(screen.getByRole('button', { name: 'Copy from Last Week' }))

    expect(await screen.findByText('boom')).toBeInTheDocument()
  })

  it('rotates the displayed week', async () => {
    const server = startServer()
    await renderLoaded(server)

    fireEvent.click(screen.getByRole('button', { name: 'Rotate' }))

    // Which row the chip lands in is the backend's business and is checked in
    // a browser; what this pins is the week the request names.
    await waitFor(() =>
      expect(server.callsTo('/api/chores/weeks/rotate', 'POST')).toEqual([
        {
          url: '/api/chores/weeks/rotate',
          method: 'POST',
          body: { week: THIS_WEEK },
        },
      ]),
    )
    expect(screen.queryByText('boom')).not.toBeInTheDocument()
  })

  it("renders the server's message when the rotate fails", async () => {
    const server = startServer((url) => url.endsWith('/weeks/rotate'))
    await renderLoaded(server)

    fireEvent.click(screen.getByRole('button', { name: 'Rotate' }))

    expect(await screen.findByText('boom')).toBeInTheDocument()
  })

  it('falls back to the empty-roster message when the load fails', async () => {
    startServer((url, method) => method === 'GET' && url.startsWith('/api/chores'))
    render(<AssignmentsTab />, { wrapper: Wrapper })

    expect(await screen.findByText('boom')).toBeInTheDocument()
    expect(
      screen.getByText('No people found. Add some in the People tab first.'),
    ).toBeInTheDocument()
  })
})

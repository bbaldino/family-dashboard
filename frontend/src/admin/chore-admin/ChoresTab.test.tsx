import { describe, expect, it, afterEach, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ChoresTab } from './ChoresTab'
import { startChoreServer, type ChoreServer } from './choreServer'
import type { Chore } from '@/integrations/chores'

/**
 * Characterization tests: what this tab does *today*, written against the
 * hand-rolled `useState` + `api` version before it moved onto the chores
 * integration's hooks.
 *
 * The body this form composes is the thing worth pinning. `pick_from_tags` is
 * sent as `[]` for a regular chore rather than omitted, and is only populated
 * from the second tag field when the type is meta — a chore that loses its
 * `pick_from_tags` picks nothing on the wall display, and the tab itself would
 * still look right.
 */

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
    name: 'Pick a room',
    description: null,
    chore_type: 'meta',
    tags: ['weekly'],
    pick_from_tags: ['bedroom', 'bathroom'],
  },
]

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

/** Renders and waits out the mount-time catalog load. */
async function renderLoaded(server: ChoreServer) {
  render(<ChoresTab />, { wrapper: Wrapper })
  expect(screen.getByText('Loading chores...')).toBeInTheDocument()
  await screen.findByText(server.chores[0].name)
}

/** Types into a tag field and commits it the way a blur would. */
function addTags(placeholder: string, value: string) {
  const input = screen.getByPlaceholderText(placeholder)
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ChoresTab', () => {
  it('renders the catalog the mount-time load returns', async () => {
    const server = startChoreServer({ chores: CHORES })
    await renderLoaded(server)

    expect(screen.getByText('Dishes')).toBeInTheDocument()
    expect(screen.getByText('After dinner')).toBeInTheDocument()
    expect(screen.getByText('kitchen')).toBeInTheDocument()
    // A meta chore is badged; a regular one is not.
    expect(screen.getByText('meta')).toBeInTheDocument()
    expect(server.callsTo('/api/chores/chores', 'GET')).toHaveLength(1)
  })

  it('renders the empty state when the catalog is empty', async () => {
    startChoreServer({ chores: [] })
    render(<ChoresTab />, { wrapper: Wrapper })

    expect(await screen.findByText('No chores yet. Add one above.')).toBeInTheDocument()
  })

  it("renders the server's message when the catalog fails to load", async () => {
    startChoreServer({ chores: CHORES, failWhen: (_url, method) => method === 'GET' })
    render(<ChoresTab />, { wrapper: Wrapper })

    expect(await screen.findByText('boom')).toBeInTheDocument()
  })

  it('creates a regular chore, sending an empty pick_from_tags', async () => {
    const server = startChoreServer({ chores: CHORES })
    await renderLoaded(server)

    fireEvent.click(screen.getByRole('button', { name: 'Add Chore' }))
    fireEvent.change(screen.getByPlaceholderText('Chore name'), { target: { value: '  Sweep  ' } })
    fireEvent.change(screen.getByPlaceholderText('Optional description'), {
      target: { value: 'Downstairs' },
    })
    addTags('Type tags, press Enter or comma to add', 'floor, weekly')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Sweep')
    expect(server.callsTo('/api/chores/chores', 'POST')).toEqual([
      {
        url: '/api/chores/chores',
        method: 'POST',
        body: {
          name: 'Sweep',
          description: 'Downstairs',
          chore_type: 'regular',
          tags: ['floor', 'weekly'],
          pick_from_tags: [],
        },
      },
    ])
    expect(screen.queryByPlaceholderText('Chore name')).not.toBeInTheDocument()
  })

  it('sends a blank description as null', async () => {
    const server = startChoreServer({ chores: CHORES })
    await renderLoaded(server)

    fireEvent.click(screen.getByRole('button', { name: 'Add Chore' }))
    fireEvent.change(screen.getByPlaceholderText('Chore name'), { target: { value: 'Sweep' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Sweep')
    expect(server.callsTo('/api/chores/chores', 'POST')[0].body).toMatchObject({
      description: null,
    })
  })

  it('creates a meta chore with the tags it picks from', async () => {
    const server = startChoreServer({ chores: CHORES })
    await renderLoaded(server)

    fireEvent.click(screen.getByRole('button', { name: 'Add Chore' }))
    fireEvent.change(screen.getByPlaceholderText('Chore name'), { target: { value: 'Pick one' } })
    fireEvent.click(screen.getByRole('button', { name: 'Meta' }))
    addTags('Tags to pick from', 'bedroom, bathroom')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Pick one')
    expect(server.callsTo('/api/chores/chores', 'POST')[0].body).toEqual({
      name: 'Pick one',
      description: null,
      chore_type: 'meta',
      tags: [],
      pick_from_tags: ['bedroom', 'bathroom'],
    })
  })

  it('updates an existing chore with a PUT to its id', async () => {
    const server = startChoreServer({ chores: CHORES })
    await renderLoaded(server)

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])
    // The form opens seeded with the chore being edited.
    expect(screen.getByPlaceholderText('Chore name')).toHaveValue('Dishes')
    expect(screen.getByPlaceholderText('Optional description')).toHaveValue('After dinner')
    fireEvent.change(screen.getByPlaceholderText('Chore name'), { target: { value: 'Wash up' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Wash up')
    expect(server.callsTo('/api/chores/chores/100', 'PUT')).toEqual([
      {
        url: '/api/chores/chores/100',
        method: 'PUT',
        body: {
          name: 'Wash up',
          description: 'After dinner',
          chore_type: 'regular',
          tags: ['kitchen'],
          pick_from_tags: [],
        },
      },
    ])
  })

  it("renders the server's message when a save fails, leaving the form open", async () => {
    const server = startChoreServer({
      chores: CHORES,
      failWhen: (_url, method) => method === 'POST',
    })
    await renderLoaded(server)

    fireEvent.click(screen.getByRole('button', { name: 'Add Chore' }))
    fireEvent.change(screen.getByPlaceholderText('Chore name'), { target: { value: 'Sweep' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('boom')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Chore name')).toHaveValue('Sweep')
  })

  it('deletes a chore and drops it from the list', async () => {
    const server = startChoreServer({ chores: CHORES })
    await renderLoaded(server)

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])

    await waitFor(() => expect(screen.queryByText('Dishes')).not.toBeInTheDocument())
    expect(server.callsTo('/api/chores/chores/100', 'DELETE')).toHaveLength(1)
    expect(screen.getByText('Pick a room')).toBeInTheDocument()
  })

  it("renders the server's message when a delete fails, keeping the row", async () => {
    const server = startChoreServer({
      chores: CHORES,
      failWhen: (_url, method) => method === 'DELETE',
    })
    await renderLoaded(server)

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])

    expect(await screen.findByText('boom')).toBeInTheDocument()
    expect(screen.getByText('Dishes')).toBeInTheDocument()
  })
})

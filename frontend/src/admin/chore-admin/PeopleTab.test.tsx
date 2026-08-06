import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PeopleTab } from './PeopleTab'
import { startChoreServer, type ChoreServer } from './choreServer'
import type { Person } from '@/integrations/chores'

/**
 * Characterization tests: what this tab does *today*. They were written and
 * committed against the hand-rolled `useState` + `api` version, before it was
 * moved onto the chores integration's hooks, and they are the only safety net
 * that refactor has.
 *
 * The load-bearing one is the multipart save. Name, colour and avatar go up as
 * `FormData` — a JSON body would be silently accepted by nothing, and an
 * avatar sent any other way never reaches disk. So the assertions pin the
 * method, the URL and the decoded multipart fields for both create and update.
 */

const PEOPLE: Person[] = [
  { id: 1, name: 'Ben', color: '#e88a6a', avatar: null },
  { id: 2, name: 'Sam', color: '#6a9aba', avatar: 'sam.png' },
]

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

/** Renders and waits out the mount-time roster load. */
async function renderLoaded(server: ChoreServer) {
  render(<PeopleTab />, { wrapper: Wrapper })
  expect(screen.getByText('Loading people...')).toBeInTheDocument()
  if (server.people.length > 0) await screen.findByText(server.people[0].name)
  return server
}

beforeEach(() => {
  // jsdom has no object URLs; the avatar preview asks for one on file pick.
  URL.createObjectURL = vi.fn(() => 'blob:preview')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PeopleTab', () => {
  it('renders the roster the mount-time load returns', async () => {
    const server = startChoreServer({ people: PEOPLE })
    await renderLoaded(server)

    expect(screen.getByText('Ben')).toBeInTheDocument()
    expect(screen.getByText('Sam')).toBeInTheDocument()
    expect(server.callsTo('/api/chores/people', 'GET')).toHaveLength(1)
  })

  it('shows a person with an avatar as an image from the per-person avatar route', async () => {
    const server = startChoreServer({ people: PEOPLE })
    await renderLoaded(server)

    // Deliberately preserved: this route does not exist on the backend. It is a
    // known bug tracked separately, not something the api-confinement work
    // should quietly change.
    expect(screen.getByRole('img', { name: 'Sam' })).toHaveAttribute(
      'src',
      '/api/chores/people/2/avatar',
    )
    // Someone with no avatar gets their initial instead.
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('renders the empty state when nobody is saved', async () => {
    startChoreServer({ people: [] })
    render(<PeopleTab />, { wrapper: Wrapper })

    expect(await screen.findByText('No people yet. Add one above.')).toBeInTheDocument()
  })

  it("renders the server's message when the roster fails to load", async () => {
    startChoreServer({ people: PEOPLE, failWhen: (_url, method) => method === 'GET' })
    render(<PeopleTab />, { wrapper: Wrapper })

    expect(await screen.findByText('boom')).toBeInTheDocument()
  })

  it('creates a person with a multipart POST carrying name and colour', async () => {
    const server = startChoreServer({ people: PEOPLE })
    await renderLoaded(server)

    fireEvent.click(screen.getByRole('button', { name: 'Add Person' }))
    fireEvent.change(screen.getByPlaceholderText('Person name'), { target: { value: 'Kai' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Kai')
    expect(server.callsTo('/api/chores/people', 'POST')).toEqual([
      {
        url: '/api/chores/people',
        method: 'POST',
        body: { name: 'Kai', color: '#e88a6a' },
      },
    ])
    // The form closes on success.
    expect(screen.queryByPlaceholderText('Person name')).not.toBeInTheDocument()
  })

  it('sends the picked avatar file in the same multipart body', async () => {
    const server = startChoreServer({ people: [] })
    const { container } = render(<PeopleTab />, { wrapper: Wrapper })
    await screen.findByText('No people yet. Add one above.')

    fireEvent.click(screen.getByRole('button', { name: 'Add Person' }))
    fireEvent.change(screen.getByPlaceholderText('Person name'), { target: { value: 'Kai' } })
    const file = new File(['png-bytes'], 'kai.png', { type: 'image/png' })
    const fileInput = container.querySelector('input[type="file"]')!
    fireEvent.change(fileInput, { target: { files: [file] } })

    // The picked file previews from an object URL before it is ever uploaded.
    expect(await screen.findByRole('img', { name: 'Preview' })).toHaveAttribute(
      'src',
      'blob:preview',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Kai')
    expect(server.callsTo('/api/chores/people', 'POST')[0].body).toEqual({
      name: 'Kai',
      color: '#e88a6a',
      avatar: 'kai.png',
    })
  })

  it('trims the name and skips the save entirely when it is blank', async () => {
    const server = startChoreServer({ people: PEOPLE })
    await renderLoaded(server)

    fireEvent.click(screen.getByRole('button', { name: 'Add Person' }))
    fireEvent.change(screen.getByPlaceholderText('Person name'), { target: { value: '  Kai  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Kai')
    expect(server.callsTo('/api/chores/people', 'POST')[0].body).toEqual({
      name: 'Kai',
      color: '#e88a6a',
    })
  })

  it('updates an existing person with a multipart PUT to their id', async () => {
    const server = startChoreServer({ people: PEOPLE })
    await renderLoaded(server)

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])
    // The form opens seeded with the person being edited.
    expect(screen.getByPlaceholderText('Person name')).toHaveValue('Ben')
    fireEvent.change(screen.getByPlaceholderText('Person name'), { target: { value: 'Benjamin' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Benjamin')
    expect(server.callsTo('/api/chores/people/1', 'PUT')).toEqual([
      {
        url: '/api/chores/people/1',
        method: 'PUT',
        body: { name: 'Benjamin', color: '#e88a6a' },
      },
    ])
  })

  it("renders the server's message when a save fails, leaving the form open", async () => {
    // Added after the rewire, not a characterization test. The old raw `fetch`
    // never checked `resp.ok`, so a rejected save closed the form and silently
    // did nothing; going through the integration's error handling it now says
    // what went wrong and keeps what was typed.
    const server = startChoreServer({
      people: PEOPLE,
      failWhen: (_url, method) => method === 'POST',
    })
    await renderLoaded(server)

    fireEvent.click(screen.getByRole('button', { name: 'Add Person' }))
    fireEvent.change(screen.getByPlaceholderText('Person name'), { target: { value: 'Kai' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('boom')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Person name')).toHaveValue('Kai')
  })

  it('deletes a person and drops them from the list', async () => {
    const server = startChoreServer({ people: PEOPLE })
    await renderLoaded(server)

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])

    await waitFor(() => expect(screen.queryByText('Ben')).not.toBeInTheDocument())
    expect(server.callsTo('/api/chores/people/1', 'DELETE')).toHaveLength(1)
    expect(screen.getByText('Sam')).toBeInTheDocument()
  })

  it("renders the server's message when a delete fails, keeping the row", async () => {
    const server = startChoreServer({
      people: PEOPLE,
      failWhen: (_url, method) => method === 'DELETE',
    })
    await renderLoaded(server)

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])

    expect(await screen.findByText('boom')).toBeInTheDocument()
    expect(screen.getByText('Ben')).toBeInTheDocument()
  })
})

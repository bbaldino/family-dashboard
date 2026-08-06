import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MusicSettings } from './MusicSettings'

/**
 * The point of this file is the default-player dropdown, and specifically
 * *which* field of a player feeds it. `music.default_player` stores a player
 * **id**; binding the `<option>` to the display name instead would leave the
 * screen looking entirely correct while writing a value nothing can resolve,
 * and nothing would surface it until the wall panel next tried to play
 * something. So the option values and the saved PUT body are both asserted
 * against the id, not the label.
 */

const CONFIG: Record<string, string> = {
  'music.service_url': 'http://music.local:8095',
  'music.api_token': 'sekrit',
  'music.default_player': '',
}

const RAW_PLAYERS = [
  { player_id: 'kitchen-sonos', display_name: 'Kitchen', can_group_with: [] },
  { player_id: 'office-sonos', display_name: 'Office', can_group_with: [] },
]

let puts: { url: string; body: string }[] = []

function mockFetch() {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const json = (value: unknown) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(value),
        text: () => Promise.resolve(JSON.stringify(value)),
      } as Response)

    if (url === '/api/config') return json(CONFIG)
    if (url === '/api/music/players') return json(RAW_PLAYERS)
    if (url.startsWith('/api/config/') && init?.method === 'PUT') {
      puts.push({ url, body: String(init.body) })
      return json({})
    }
    return Promise.reject(new Error(`Unexpected fetch url: ${url}`))
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

async function renderLoaded() {
  render(<MusicSettings />, { wrapper: Wrapper })
  await screen.findByDisplayValue('http://music.local:8095')
}

describe('MusicSettings default player', () => {
  beforeEach(() => {
    puts = []
    mockFetch()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('offers a free-text player id until players are loaded', async () => {
    await renderLoaded()

    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getByPlaceholderText(/Player ID/)).toBeInTheDocument()
  })

  it('lists loaded players by name but values each option with its player id', async () => {
    await renderLoaded()

    fireEvent.click(screen.getByRole('button', { name: 'Load Players' }))

    const select = await screen.findByRole('combobox')
    const options = within(select).getAllByRole('option') as HTMLOptionElement[]

    expect(options.map((o) => o.textContent)).toEqual(['Select a player...', 'Kitchen', 'Office'])
    expect(options.map((o) => o.value)).toEqual(['', 'kitchen-sonos', 'office-sonos'])
  })

  it('saves the selected player id, not its display name', async () => {
    await renderLoaded()

    fireEvent.click(screen.getByRole('button', { name: 'Load Players' }))
    const select = await screen.findByRole('combobox')
    fireEvent.change(select, { target: { value: 'office-sonos' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(puts).toHaveLength(3))
    const defaultPlayerPut = puts.find((p) => p.url.endsWith('music.default_player'))
    expect(defaultPlayerPut?.body).toBe(JSON.stringify({ value: 'office-sonos' }))
  })

  it('reports a failed player load without wiping the form', async () => {
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/config') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(CONFIG),
          text: () => Promise.resolve(JSON.stringify(CONFIG)),
        } as Response)
      }
      return Promise.resolve({
        ok: false,
        status: 502,
        json: () => Promise.resolve({ error: 'connection refused' }),
        text: () => Promise.resolve('{"error":"connection refused"}'),
      } as Response)
    }) as unknown as typeof fetch

    await renderLoaded()

    fireEvent.click(screen.getByRole('button', { name: 'Load Players' }))

    expect(await screen.findByText(/check URL and token/)).toBeInTheDocument()
    expect(screen.getByDisplayValue('http://music.local:8095')).toBeInTheDocument()
  })
})

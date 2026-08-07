import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SportsSettings } from './SportsSettings'
import { CONFIG_QUERY_KEY, useAllConfig } from '@/platform'

/**
 * Characterization tests: these describe what this screen does *today*, and
 * they are what makes the `api`-confinement refactor safe to attempt.
 *
 * The load-bearing one is the legacy backfill. When `sports.tracked_teams`
 * holds entries saved before name/logo were stored, the mount-time load
 * fetches each tracked league's roster and enriches those entries — and the
 * enriched array is what `Save` serialises straight back into config. So the
 * backfill is not a display nicety; it is in the write path. A refactor that
 * changed *when* it resolves relative to the save could silently persist the
 * bare `{league, teamId}` entries and undo the enrichment for good, and
 * nothing on screen would look wrong at the time.
 *
 * Assertions are on user-visible output and on the exact saved payload, not
 * on request counts, so that a caching change that keeps behaviour identical
 * does not read as a failure.
 */

const LEGACY_TRACKED = [
  { league: 'nba', teamId: 'lal' },
  { league: 'nba', teamId: 'bos' },
  { league: 'nhl', teamId: 'col' },
  // Tracked but absent from the league roster — stays bare, pills fall back to the id.
  { league: 'nhl', teamId: 'ghost' },
]

const NBA_TEAMS = [
  {
    id: 'lal',
    name: 'Lakers',
    displayName: 'Los Angeles Lakers',
    abbreviation: 'LAL',
    logo: 'https://cdn.test/lal.png',
    league: 'nba',
  },
  {
    id: 'bos',
    name: 'Celtics',
    displayName: 'Boston Celtics',
    abbreviation: 'BOS',
    logo: 'https://cdn.test/bos.png',
    league: 'nba',
  },
]

const NHL_TEAMS = [
  {
    id: 'col',
    name: 'Avalanche',
    displayName: 'Colorado Avalanche',
    abbreviation: 'COL',
    logo: 'https://cdn.test/col.png',
    league: 'nhl',
  },
]

const SEARCH_TEAMS = [
  {
    id: 'bos-sox',
    name: 'Red Sox',
    displayName: 'Boston Red Sox',
    abbreviation: 'BOS',
    logo: 'https://cdn.test/sox.png',
    league: 'mlb',
  },
]

let puts: { url: string; body: string }[] = []
let requested: string[] = []

interface MockOptions {
  tracked?: unknown[]
  failSearch?: boolean
}

function mockFetch({ tracked = LEGACY_TRACKED, failSearch = false }: MockOptions = {}) {
  const config: Record<string, string> = {
    'sports.tracked_teams': JSON.stringify(tracked),
    'sports.poll_interval_live': '10',
    'sports.poll_interval_idle': '600',
    'sports.window_hours': '48',
    'sports.model': 'llama3.1:8b',
  }

  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    requested.push(url)
    const json = (value: unknown, ok = true) =>
      Promise.resolve({
        ok,
        status: ok ? 200 : 500,
        json: () => Promise.resolve(value),
        text: () => Promise.resolve(JSON.stringify(value)),
      } as Response)

    if (url === '/api/config') return json(config)
    if (url === '/api/llm/models') return json({ models: [{ name: 'llama3.1:8b' }] })
    if (url === '/api/sports/teams?league=nba') return json({ teams: NBA_TEAMS })
    if (url === '/api/sports/teams?league=nhl') return json({ teams: NHL_TEAMS })
    if (url === '/api/sports/teams?league=nfl') return json({ teams: [] })
    if (url === '/api/sports/teams?league=mlb') return json({ teams: [] })
    if (url.startsWith('/api/sports/teams/search')) {
      if (failSearch) return json({ error: 'upstream down' }, false)
      return json({ teams: SEARCH_TEAMS })
    }
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

/** Renders and waits out the mount-time config load (and any backfill). */
async function renderLoaded(options?: MockOptions) {
  mockFetch(options)
  render(<SportsSettings />, { wrapper: Wrapper })
  await screen.findByText('Browse by League')
}

/** The `sports.tracked_teams` value the screen would persist right now. */
function savedTrackedTeams() {
  const put = puts.find((p) => p.url.endsWith('sports.tracked_teams'))
  if (!put) throw new Error('sports.tracked_teams was never saved')
  return JSON.parse(JSON.parse(put.body).value as string)
}

describe('SportsSettings', () => {
  beforeEach(() => {
    puts = []
    requested = []
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('legacy backfill (the config write path)', () => {
    it('saves tracked teams enriched with the names and logos the backfill fetched', async () => {
      await renderLoaded()

      // The enrichment has to have landed before Save, which is the whole point.
      await screen.findByText('Lakers')

      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() => expect(puts).toHaveLength(5))
      expect(savedTrackedTeams()).toEqual([
        { league: 'nba', teamId: 'lal', name: 'Lakers', logo: 'https://cdn.test/lal.png' },
        { league: 'nba', teamId: 'bos', name: 'Celtics', logo: 'https://cdn.test/bos.png' },
        { league: 'nhl', teamId: 'col', name: 'Avalanche', logo: 'https://cdn.test/col.png' },
        // Unresolvable entries survive untouched rather than being dropped.
        { league: 'nhl', teamId: 'ghost' },
      ])
    })

    it('shows the backfilled names as pills, falling back to the id when unresolvable', async () => {
      await renderLoaded()

      expect(await screen.findByText('Lakers')).toBeInTheDocument()
      expect(screen.getByText('Celtics')).toBeInTheDocument()
      expect(screen.getByText('Avalanche')).toBeInTheDocument()
      expect(screen.getByText('ghost')).toBeInTheDocument()
    })

    it('seeds the league browser, so an already-backfilled league expands without reloading', async () => {
      await renderLoaded()
      await screen.findByText('Lakers')

      fireEvent.click(screen.getByRole('button', { name: /NBA/ }))

      // Synchronous: the backfill already supplied this league's roster.
      expect(screen.getByText('Los Angeles Lakers')).toBeInTheDocument()
      expect(screen.queryByText('Loading teams...')).toBeNull()
    })

    it('does not fetch any roster when every tracked team already has a name', async () => {
      await renderLoaded({
        tracked: [
          { league: 'nba', teamId: 'lal', name: 'Lakers', logo: 'https://cdn.test/lal.png' },
        ],
      })
      await screen.findByText('Lakers')

      expect(requested.filter((u) => u.includes('/teams?league='))).toEqual([])
    })

    it('keeps the bare entries when the roster fetch fails, rather than losing them', async () => {
      mockFetch()
      const original = globalThis.fetch
      globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes('/teams?league=')) {
          return Promise.reject(new Error('network down'))
        }
        return (original as typeof fetch)(input, init)
      }) as unknown as typeof fetch

      render(<SportsSettings />, { wrapper: Wrapper })
      await screen.findByText('Browse by League')
      await screen.findByText('lal')

      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() => expect(puts).toHaveLength(5))
      expect(savedTrackedTeams()).toEqual(LEGACY_TRACKED)
    })
  })

  describe('browsing a league on demand', () => {
    it('loads a league roster when it is expanded', async () => {
      await renderLoaded({ tracked: [] })

      fireEvent.click(screen.getByRole('button', { name: /NHL/ }))

      expect(await screen.findByText('Colorado Avalanche')).toBeInTheDocument()
    })

    it('does not load any roster before a league is expanded', async () => {
      await renderLoaded({ tracked: [] })

      expect(requested.filter((u) => u.includes('/teams?league='))).toEqual([])
    })

    // Added after the refactor, not a characterization test: the banner is the
    // only sign a league's roster never arrived, and the panel underneath it
    // sits on "Loading teams..." forever either way.
    it('names the league in the banner when its roster fails to load', async () => {
      mockFetch({ tracked: [] })
      const original = globalThis.fetch
      globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes('/teams?league=nba')) {
          return Promise.reject(new Error('network down'))
        }
        return (original as typeof fetch)(input, init)
      }) as unknown as typeof fetch

      render(<SportsSettings />, { wrapper: Wrapper })
      await screen.findByText('Browse by League')

      fireEvent.click(screen.getByRole('button', { name: /NBA/ }))

      expect(await screen.findByText('Failed to load NBA teams')).toBeInTheDocument()
    })
  })

  describe('team search', () => {
    it('url-encodes the query, including spaces and ampersands', async () => {
      await renderLoaded({ tracked: [] })

      fireEvent.change(screen.getByPlaceholderText('Search by team name...'), {
        target: { value: 'sox & socks' },
      })

      await waitFor(() =>
        expect(requested).toContain('/api/sports/teams/search?q=sox%20%26%20socks'),
      )
      expect(await screen.findByText('Boston Red Sox')).toBeInTheDocument()
    })

    it('does not search a query shorter than two characters', async () => {
      await renderLoaded({ tracked: [] })

      fireEvent.change(screen.getByPlaceholderText('Search by team name...'), {
        target: { value: 'b' },
      })

      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(requested.filter((u) => u.includes('/teams/search'))).toEqual([])
    })

    it('fails a search silently rather than showing an error banner', async () => {
      await renderLoaded({ tracked: [], failSearch: true })

      fireEvent.change(screen.getByPlaceholderText('Search by team name...'), {
        target: { value: 'sox' },
      })

      await waitFor(() => expect(requested.some((u) => u.includes('/teams/search'))).toBe(true))
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(screen.queryByText(/Failed/)).toBeNull()
    })

    it('adds a searched team to the tracked list and saves it', async () => {
      await renderLoaded({ tracked: [] })

      fireEvent.change(screen.getByPlaceholderText('Search by team name...'), {
        target: { value: 'sox' },
      })
      const result = await screen.findByText('Boston Red Sox')
      fireEvent.click(result.closest('label')!.querySelector('input[type="checkbox"]')!)

      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() => expect(puts).toHaveLength(5))
      expect(savedTrackedTeams()).toEqual([
        { league: 'mlb', teamId: 'bos-sox', name: 'Red Sox', logo: 'https://cdn.test/sox.png' },
      ])
    })
  })
})

/** A second consumer of the shared query, so a test can tell when a refresh
 *  has actually reached the components rather than just the cache. */
function Probe() {
  const { data } = useAllConfig()
  return <div data-testid="probe">{data?.['sports.poll_interval_live'] ?? ''}</div>
}

describe('SportsSettings prefill', () => {
  beforeEach(() => {
    puts = []
    requested = []
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // The property the one-shot prefill exists for. Unsaved edits live only in
  // this component's state — they are never in /api/config — so a form that
  // tracked the query would throw away whatever someone had typed on the
  // next poll tick, with nobody else having changed a thing. This screen
  // seeds via a `useMemo(…, [])` rather than a lazy `useState`; the property
  // is the same either way.
  it('does not overwrite an in-progress edit when the config query refreshes', async () => {
    const fetchMock = mockFetch()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        {/* The probe is the synchronisation point: react-query notifies its
         *  observers a tick after the refetch resolves, so asserting straight
         *  after `invalidateQueries` would pass before the new config had
         *  reached any component at all. */}
        <Probe />
        <SportsSettings />
      </QueryClientProvider>,
    )
    await screen.findByText('Browse by League')

    fireEvent.change(screen.getByDisplayValue('10'), { target: { value: '99' } })

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/config') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ 'sports.poll_interval_live': '7' }),
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('{}'),
      } as Response)
    })
    await act(async () => {
      await client.invalidateQueries({ queryKey: CONFIG_QUERY_KEY })
    })
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('7'))

    expect(screen.getByDisplayValue('99')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('7')).not.toBeInTheDocument()
  })
})

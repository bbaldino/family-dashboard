import { describe, expect, it, vi, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ServiceCard } from './ServiceCard'
import type { Service } from './types'

/**
 * A card's uptime and history reads go through `healthIntegration.api` too.
 * They are gated on the card being expanded, so nothing is requested until the
 * user opens one — and a failed request must reach the panel as a failure
 * rather than as a parsed error body drawn where the log should be.
 */
function stubFetch(routes: Record<string, { status: number; body: unknown }>) {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      calls.push(url)
      const route = routes[url] ?? { status: 404, body: { error: `no stub for ${url}` } }
      return Promise.resolve({
        ok: route.status >= 200 && route.status < 300,
        status: route.status,
        json: () => Promise.resolve(route.body),
        text: () => Promise.resolve(JSON.stringify(route.body)),
      } as Response)
    }),
  )
  return calls
}

const SERVICE: Service = {
  id: 7,
  name: 'Unraid',
  type_id: 'http',
  interval_secs: 60,
  enabled: true,
  status: 'ok',
  message: null,
  components: [],
  updated_at: null,
}

const UPTIME = {
  window_secs: 86_400,
  ok_secs: 86_400,
  degraded_secs: 0,
  critical_secs: 0,
  unknown_secs: 0,
  percent_ok: 99.5,
  segments: [{ status: 'ok', start: 1_700_000_000, end: 1_700_086_400 }],
}

const HISTORY = [{ status: 'ok', message: 'all good', components: [], at: 1_700_086_400 }]

const UPTIME_URL = '/api/health/uptime/7?window=86400'
const HISTORY_URL = '/api/health/history/7?limit=20'

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return render(<ServiceCard service={SERVICE} />, { wrapper: Wrapper })
}

afterEach(() => vi.unstubAllGlobals())

describe('ServiceCard', () => {
  it('asks for nothing until the card is expanded, then for both panels', async () => {
    const calls = stubFetch({
      [UPTIME_URL]: { status: 200, body: UPTIME },
      [HISTORY_URL]: { status: 200, body: HISTORY },
    })
    renderCard()

    expect(calls).toEqual([])

    fireEvent.click(screen.getByRole('button'))

    expect(await screen.findByText('99.5% uptime')).toBeInTheDocument()
    expect(await screen.findByText('all good')).toBeInTheDocument()
    expect([...calls].sort()).toEqual([HISTORY_URL, UPTIME_URL].sort())
  })

  it('shows an error rather than rendering a failed history response as samples', async () => {
    const calls = stubFetch({
      [UPTIME_URL]: { status: 200, body: UPTIME },
      [HISTORY_URL]: { status: 400, body: HISTORY },
    })
    renderCard()
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(screen.getByText("Couldn't load history.")).toBeInTheDocument())
    expect(screen.queryByText('all good')).not.toBeInTheDocument()
    expect(calls).toContain(HISTORY_URL)
  })
})

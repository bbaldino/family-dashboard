import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { HealthBoard } from './HealthBoard'

/**
 * The board reads through `healthIntegration.api`, which checks `resp.ok`
 * before parsing. It used to call `fetch` directly and cast the parsed body to
 * `Service[]`, and `fetch` only rejects on a *network* error — so a 400 came
 * back resolved and the error body was rendered as the service list.
 *
 * The stub below is that failure in its worst form: a non-2xx response whose
 * body is a perfectly well-shaped service array. Nothing downstream can tell
 * it apart from real data; only the status code can, and only if something
 * looks. If this test starts passing with the board's error branch removed,
 * the guard is gone.
 */
function stubFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(JSON.stringify(body)),
      } as Response),
    ),
  )
}

const SERVICES = [
  {
    id: 1,
    name: 'Unraid',
    type_id: 'http',
    interval_secs: 60,
    enabled: true,
    status: 'ok',
    message: null,
    components: [],
    updated_at: null,
  },
]

function renderBoard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return render(<HealthBoard />, { wrapper: Wrapper })
}

afterEach(() => vi.unstubAllGlobals())

describe('HealthBoard', () => {
  it('renders the services the health service reports', async () => {
    stubFetch(200, SERVICES)
    renderBoard()

    expect(await screen.findByText('Unraid')).toBeInTheDocument()
  })

  it('shows an error rather than rendering a failed response as the service list', async () => {
    stubFetch(400, SERVICES)
    renderBoard()

    await waitFor(() =>
      expect(screen.getByText("Couldn't reach the health service.")).toBeInTheDocument(),
    )
    expect(screen.queryByText('Unraid')).not.toBeInTheDocument()
  })
})

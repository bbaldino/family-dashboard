import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// MusicProvider reads its scenario fixture once, at module load (see the
// comment above `fixtureQueues` in MusicProvider.tsx) — activeScenario never
// changes at runtime, so there's no per-render check to test the way the
// other music hooks' queryFns can be. To exercise both branches in one file,
// each test resets the module registry and re-imports MusicProvider (and
// useMusic, which must resolve to the *same* fresh music-context instance)
// after pointing the mocked './fixtures' at the value that test needs.
const { musicStateFixtureFor } = vi.hoisted(() => ({ musicStateFixtureFor: vi.fn() }))
vi.mock('./fixtures', () => ({ musicStateFixtureFor }))

function MusicProbe({
  useMusic,
}: {
  useMusic: () => { state: { queues: unknown[] }; isConnected: boolean }
}) {
  const { state, isConnected } = useMusic()
  return (
    <div>
      <span data-testid="queue-count">{state.queues.length}</span>
      <span data-testid="connected">{String(isConnected)}</span>
    </div>
  )
}

async function freshMusicModules() {
  vi.resetModules()
  const { MusicProvider } = await import('./MusicProvider')
  const { useMusic } = await import('./useMusic')
  return { MusicProvider, useMusic }
}

function wrapInQueryClient(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
}

describe('MusicProvider scenario wiring', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    musicStateFixtureFor.mockReset()
    vi.resetModules()
  })

  it('seeds state from the fixture and never opens an EventSource when one is defined', async () => {
    const fixture = [
      {
        queueId: 'fixture-kitchen',
        displayName: 'Kitchen',
        state: 'playing' as const,
        currentItem: null,
        volumeLevel: 45,
      },
    ]
    musicStateFixtureFor.mockReturnValue(fixture)
    // jsdom has no EventSource global at all — if the fixture branch failed
    // to short-circuit and this got constructed, the render below would
    // throw a ReferenceError.
    const { MusicProvider, useMusic } = await freshMusicModules()

    render(
      wrapInQueryClient(
        <MusicProvider>
          <MusicProbe useMusic={useMusic} />
        </MusicProvider>,
      ),
    )

    expect(screen.getByTestId('queue-count')).toHaveTextContent('1')
    expect(screen.getByTestId('connected')).toHaveTextContent('true')
  })

  it('falls through to the default (unconfigured) context when no fixture is defined and nothing is configured', async () => {
    musicStateFixtureFor.mockReturnValue(undefined)
    const { MusicProvider, useMusic } = await freshMusicModules()

    render(
      wrapInQueryClient(
        <MusicProvider>
          <MusicProbe useMusic={useMusic} />
        </MusicProvider>,
      ),
    )

    // useIntegrationConfig resolves asynchronously to {} (stubbed fetch
    // above), which parses to an unconfigured integration — same as today,
    // untouched by the fixture wiring.
    expect(await screen.findByTestId('queue-count')).toHaveTextContent('0')
    expect(screen.getByTestId('connected')).toHaveTextContent('false')
  })

  it('still opens a real EventSource when configured and no fixture is defined for the active scenario', async () => {
    musicStateFixtureFor.mockReturnValue(undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ 'music.service_url': 'http://192.168.1.42:8095/' }),
      }),
    )
    const openedUrls: string[] = []
    class FakeEventSource {
      constructor(url: string) {
        openedUrls.push(url)
      }
      addEventListener() {}
      close() {}
    }
    vi.stubGlobal('EventSource', FakeEventSource)

    const { MusicProvider, useMusic } = await freshMusicModules()

    render(
      wrapInQueryClient(
        <MusicProvider>
          <MusicProbe useMusic={useMusic} />
        </MusicProvider>,
      ),
    )

    // The first render sees config still loading (isConfigured false, no
    // connection attempt); the effect re-runs once useIntegrationConfig's
    // own fetch resolves and isConfigured flips true — wait for that.
    await waitFor(() => expect(openedUrls).toEqual(['/api/music/events']))
  })
})

/**
 * Transport actions used to reject into nothing: no call site awaits them, so
 * a failure became an unhandled promise rejection and the screen was identical
 * to a tap that was ignored. A track Music Assistant returned 500 for on every
 * attempt looked simply dead, and finding out why meant reading server logs.
 */
describe('MusicProvider action failures', () => {
  function ErrorProbe({
    useMusic,
  }: {
    useMusic: () => {
      actionError: { message: string } | null
      play: (uri: string, options?: { name?: string }) => Promise<void>
    }
  }) {
    const { actionError, play } = useMusic()
    return (
      <div>
        <button type="button" onClick={() => play('spotify://track/x', { name: 'Go' })}>
          play
        </button>
        <span data-testid="error">{actionError?.message ?? ''}</span>
      </div>
    )
  }

  beforeEach(() => {
    musicStateFixtureFor.mockReturnValue([])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    musicStateFixtureFor.mockReset()
    vi.resetModules()
  })

  it('records a failed play, naming the item, instead of dropping the rejection', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((url: string) =>
          String(url).includes('/api/music/play')
            ? Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('boom') })
            : Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
        ),
    )
    const { MusicProvider, useMusic } = await freshMusicModules()
    render(
      wrapInQueryClient(
        <MusicProvider>
          <ErrorProbe useMusic={useMusic as never} />
        </MusicProvider>,
      ),
    )

    screen.getByText('play').click()
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Couldn’t play “Go”'))
  })

  it('leaves actionError null when the action succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }))
    const { MusicProvider, useMusic } = await freshMusicModules()
    render(
      wrapInQueryClient(
        <MusicProvider>
          <ErrorProbe useMusic={useMusic as never} />
        </MusicProvider>,
      ),
    )

    screen.getByText('play').click()
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent(''))
  })
})

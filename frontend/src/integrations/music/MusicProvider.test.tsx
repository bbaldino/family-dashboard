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
//
// Only the queue-state fixture is mocked: the anchor and players fixtures
// stay real, so `useAnchorId` and `useGroupTopology` behave here exactly as
// they do with no scenario active (both return `undefined`, i.e. "use the
// live config and the live `/players` fetch").
const { musicStateFixtureFor } = vi.hoisted(() => ({ musicStateFixtureFor: vi.fn() }))
vi.mock('./fixtures', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./fixtures')>()),
  musicStateFixtureFor,
}))

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

/**
 * The provider's own wiring of the anchor rule (`anchor.ts` covers the rule
 * itself). Reported from staging: a Kitchen-anchored panel read "Now
 * playing in the Deck", because the derivation took the first playing —
 * else paused — queue anywhere in the house and only used the anchor to
 * break ties among idle ones.
 *
 * These go through the real `useAnchorId` and `useGroupTopology`, so they
 * also pin that the provider actually reads `music.default_player` and the
 * live `/players` list rather than deriving from queues alone.
 */
describe('MusicProvider anchoring', () => {
  function AnchorProbe({
    useMusic,
  }: {
    useMusic: () => { state: { activeQueue: { displayName: string } | null } }
    anchorRoomLabel?: string | null
  }) {
    const { state, anchorRoomLabel } = useMusic() as ReturnType<typeof useMusic> & {
      anchorRoomLabel: string | null
    }
    return (
      <div>
        <span data-testid="active-room">{state.activeQueue?.displayName ?? 'none'}</span>
        <span data-testid="anchor-label">{anchorRoomLabel ?? 'none'}</span>
      </div>
    )
  }

  const deckQueue = {
    queueId: 'deck',
    displayName: 'Deck',
    state: 'paused' as const,
    currentItem: {
      name: 'Harbor Lights',
      artist: 'Bellwether Coast',
      album: null,
      imageUrl: null,
      duration: 194,
      elapsed: 52,
      uri: 'fixture://track/harbor-lights',
    },
    volumeLevel: 20,
  }
  const kitchenIdleQueue = {
    queueId: 'kitchen',
    displayName: 'Kitchen',
    state: 'idle' as const,
    currentItem: null,
    volumeLevel: 45,
  }

  function stubBackend(players: unknown[]) {
    // `/api/config` is read with `.json()`; the integration's own api helper
    // reads `.text()` — so both have to be answerable.
    const bodyFor = (url: string) =>
      String(url).includes('/api/music/players')
        ? players
        : { 'music.service_url': 'http://192.168.1.42:8095/', 'music.default_player': 'kitchen' }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(bodyFor(url)),
          text: () => Promise.resolve(JSON.stringify(bodyFor(url))),
        }),
      ),
    )
    vi.stubGlobal(
      'EventSource',
      class {
        addEventListener() {}
        close() {}
      },
    )
  }

  async function renderProbe() {
    const { MusicProvider, useMusic } = await freshMusicModules()
    render(
      wrapInQueryClient(
        <MusicProvider>
          <AnchorProbe useMusic={useMusic as never} />
        </MusicProvider>,
      ),
    )
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    musicStateFixtureFor.mockReset()
    vi.resetModules()
  })

  it('shows nothing when another room is playing on its own — the reported bug', async () => {
    musicStateFixtureFor.mockReturnValue([deckQueue, kitchenIdleQueue])
    stubBackend([
      { player_id: 'deck', display_name: 'Deck', state: 'paused' },
      { player_id: 'kitchen', display_name: 'Kitchen', state: 'idle' },
    ])
    await renderProbe()

    await waitFor(() => expect(screen.getByTestId('anchor-label')).toHaveTextContent('Kitchen'))
    expect(screen.getByTestId('active-room')).toHaveTextContent('none')
  })

  it('shows the group leader’s queue, named for the anchor’s group, when the anchor is a follower', async () => {
    musicStateFixtureFor.mockReturnValue([deckQueue, kitchenIdleQueue])
    // `synced_to` left null on the follower, as MA usually reports it — the
    // leader is found from the other player's `group_members` instead.
    stubBackend([
      {
        player_id: 'deck',
        display_name: 'Deck',
        state: 'paused',
        group_members: ['deck', 'kitchen'],
      },
      { player_id: 'kitchen', display_name: 'Kitchen', state: 'idle', synced_to: null },
    ])
    await renderProbe()

    // Waiting on the label, not the room: before config and `/players` land,
    // the roomless fallback would show the Deck's queue too, so the room
    // alone can't tell a resolved group from an unresolved one.
    await waitFor(() =>
      expect(screen.getByTestId('anchor-label')).toHaveTextContent('Kitchen and Deck'),
    )
    expect(screen.getByTestId('active-room')).toHaveTextContent('Deck')
  })
})

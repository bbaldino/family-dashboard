import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
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
 * The client-side elapsed tick used to increment unconditionally, so with
 * sparse server updates (e.g. Spotify Connect) it would run past the track's
 * own duration — showing e.g. 5:53 on a 2:56 song. It must clamp to
 * `currentItem.duration` once known, while still ticking normally below it.
 */
describe('MusicProvider elapsed-time tick', () => {
  function ElapsedProbe({
    useMusic,
  }: {
    useMusic: () => {
      state: { queues: { currentItem: { elapsed: number | null } | null }[] }
    }
  }) {
    const { state } = useMusic()
    return <span data-testid="elapsed">{state.queues[0]?.currentItem?.elapsed ?? ''}</span>
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    musicStateFixtureFor.mockReset()
    vi.resetModules()
  })

  it('keeps ticking normally below the cap', async () => {
    musicStateFixtureFor.mockReturnValue([
      {
        queueId: 'kitchen',
        displayName: 'Kitchen',
        state: 'playing' as const,
        currentItem: {
          name: 'Amber Hours',
          artist: 'The Night Shift',
          album: null,
          imageUrl: null,
          duration: 200,
          elapsed: 10,
          uri: 'fixture://track/amber-hours',
        },
        volumeLevel: 45,
      },
    ])
    const { MusicProvider, useMusic } = await freshMusicModules()
    vi.useFakeTimers()

    render(
      wrapInQueryClient(
        <MusicProvider>
          <ElapsedProbe useMusic={useMusic as never} />
        </MusicProvider>,
      ),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(screen.getByTestId('elapsed')).toHaveTextContent('11')
  })

  it('never lets elapsed exceed the track duration', async () => {
    musicStateFixtureFor.mockReturnValue([
      {
        queueId: 'kitchen',
        displayName: 'Kitchen',
        state: 'playing' as const,
        currentItem: {
          name: 'Amber Hours',
          artist: 'The Night Shift',
          album: null,
          imageUrl: null,
          duration: 200,
          elapsed: 199,
          uri: 'fixture://track/amber-hours',
        },
        volumeLevel: 45,
      },
    ])
    const { MusicProvider, useMusic } = await freshMusicModules()
    vi.useFakeTimers()

    render(
      wrapInQueryClient(
        <MusicProvider>
          <ElapsedProbe useMusic={useMusic as never} />
        </MusicProvider>,
      ),
    )

    // Advance well past the point elapsed would reach the duration — an
    // uncapped tick would keep climbing (e.g. to 204), but it must sit at 200.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(screen.getByTestId('elapsed')).toHaveTextContent('200')
  })
})

/**
 * The other half of the same missing-feedback problem: a play that succeeds
 * but takes a beat to start. Music Assistant's play_media round-trip (a radio
 * attempt, its fallback, then a log lookup) can run to a noticeable pause, and
 * with nothing shown the tap reads as ignored just like a silent failure did.
 * `playPending` is set the instant `play` is called and cleared when it
 * settles, so a theme can acknowledge the tap for the gap in between.
 */
describe('MusicProvider play pending', () => {
  function PendingProbe({
    useMusic,
  }: {
    useMusic: () => {
      playPending: { label: string } | null
      play: (uri: string, options?: { name?: string }) => Promise<void>
    }
  }) {
    const { playPending, play } = useMusic()
    return (
      <div>
        <button type="button" onClick={() => play('spotify://track/x', { name: 'Go' })}>
          play
        </button>
        <span data-testid="pending">{playPending?.label ?? ''}</span>
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

  it('names the cued item the instant play is called, then clears it when the request settles', async () => {
    // Hold the /play response open so the in-flight window is observable;
    // every other fetch (config, etc.) resolves normally.
    let releasePlay: (() => void) | null = null
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (String(url).includes('/api/music/play')) {
          return new Promise((resolve) => {
            releasePlay = () =>
              resolve({
                ok: true,
                json: () => Promise.resolve({}),
                text: () => Promise.resolve(''),
              })
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      }),
    )
    const { MusicProvider, useMusic } = await freshMusicModules()
    render(
      wrapInQueryClient(
        <MusicProvider>
          <PendingProbe useMusic={useMusic as never} />
        </MusicProvider>,
      ),
    )

    // Set before the round-trip returns — the cue is what makes a slow tap
    // visibly land.
    screen.getByText('play').click()
    await waitFor(() => expect(screen.getByTestId('pending')).toHaveTextContent('“Go”'))

    // Once the play settles, the cue clears — playback is (about to be) audible.
    await act(async () => {
      releasePlay?.()
    })
    await waitFor(() => expect(screen.getByTestId('pending')).toHaveTextContent(''))
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

/**
 * The bug: a single-shot EventSource whose `onerror` did nothing but flip
 * `isConnected` false, relying on the browser's native auto-retry — which
 * the SSE spec permanently kills once a reconnect attempt gets back an HTTP
 * error status. The fix manages reconnection itself: always close-then-retry
 * on error with exponential backoff, plus an immediate retry when the tablet
 * wakes (visibilitychange/online) while disconnected.
 */
/**
 * The bug: tapping pause briefly showed paused, then the icon snapped back
 * to Play. `pause()` sets `optimisticPlaying = false`, but the SSE `'state'`
 * handler used to clear that override the moment *any* queue reported a
 * definitive 'playing' or 'paused' state — and on pause, Music Assistant
 * still reports 'playing' for a beat while Spotify Connect settles to
 * 'idle', never 'paused'. Either way the stale/non-definitive update cleared
 * the override early and the icon flipped back. The fix reconciles against
 * the *active queue's* state instead: the override only clears once the
 * active queue's playing-ness actually matches what was requested, so 'idle'
 * counts as "not playing" for a pending pause and doesn't count as "playing"
 * for a pending resume.
 */
describe('MusicProvider pause/resume anti-flicker', () => {
  class FakeEventSource {
    static instances: FakeEventSource[] = []
    url: string
    onopen: (() => void) | null = null
    onerror: (() => void) | null = null
    closed = false
    private listeners: Record<string, ((e: MessageEvent) => void)[]> = {}
    constructor(url: string) {
      this.url = url
      FakeEventSource.instances.push(this)
    }
    addEventListener(type: string, cb: (e: MessageEvent) => void) {
      ;(this.listeners[type] ??= []).push(cb)
    }
    close() {
      this.closed = true
    }
    emit(type: string, data: unknown) {
      for (const cb of this.listeners[type] ?? []) {
        cb({ data: JSON.stringify(data) } as MessageEvent)
      }
    }
  }

  function TransportProbe({
    useMusic,
  }: {
    useMusic: () => {
      isPlaying: boolean
      pause: () => Promise<void>
      resume: () => Promise<void>
    }
  }) {
    const { isPlaying, pause, resume } = useMusic()
    return (
      <div>
        <span data-testid="playing">{String(isPlaying)}</span>
        <button type="button" onClick={() => pause()}>
          pause
        </button>
        <button type="button" onClick={() => resume()}>
          resume
        </button>
      </div>
    )
  }

  const queue = (state: 'playing' | 'paused' | 'idle') => ({
    queueId: 'kitchen',
    displayName: 'Kitchen',
    state,
    currentItem: null,
    volumeLevel: 45,
  })

  beforeEach(() => {
    FakeEventSource.instances = []
    musicStateFixtureFor.mockReturnValue(undefined)
    // No `default_player` set, so `useAnchorId` resolves to `null` and
    // `deriveActiveQueue` falls back to the roomless "first active queue"
    // rule — no players list needed to exercise the reconcile logic.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ 'music.service_url': 'http://192.168.1.42:8095/' }),
        text: () => Promise.resolve('{}'),
      }),
    )
    vi.stubGlobal('EventSource', FakeEventSource)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    musicStateFixtureFor.mockReset()
    vi.resetModules()
  })

  async function renderProbe() {
    const { MusicProvider, useMusic } = await freshMusicModules()
    render(
      wrapInQueryClient(
        <MusicProvider>
          <TransportProbe useMusic={useMusic as never} />
        </MusicProvider>,
      ),
    )
    await waitFor(() => expect(FakeEventSource.instances.length).toBe(1))
    return FakeEventSource.instances[0]
  }

  it('holds pause through a stale "still playing" update, including the Spotify-Connect idle case', async () => {
    const es = await renderProbe()

    act(() => {
      es.emit('state', { type: 'state', queues: [queue('playing')] })
    })
    await waitFor(() => expect(screen.getByTestId('playing')).toHaveTextContent('true'))

    act(() => {
      screen.getByText('pause').click()
    })
    await waitFor(() => expect(screen.getByTestId('playing')).toHaveTextContent('false'))

    // A stale update still reporting 'playing' must not snap the icon back —
    // this is the bug.
    act(() => {
      es.emit('state', { type: 'state', queues: [queue('playing')] })
    })
    expect(screen.getByTestId('playing')).toHaveTextContent('false')

    // Spotify Connect settles to 'idle', never 'paused' — this must also
    // read as "paused" and clear the override.
    act(() => {
      es.emit('state', { type: 'state', queues: [queue('idle')] })
    })
    await waitFor(() => expect(screen.getByTestId('playing')).toHaveTextContent('false'))

    // The override is now cleared, so a later genuine 'playing' shows through.
    act(() => {
      es.emit('state', { type: 'state', queues: [queue('playing')] })
    })
    await waitFor(() => expect(screen.getByTestId('playing')).toHaveTextContent('true'))
  })

  it('holds resume through a transient idle update', async () => {
    const es = await renderProbe()

    act(() => {
      es.emit('state', { type: 'state', queues: [queue('paused')] })
    })
    await waitFor(() => expect(screen.getByTestId('playing')).toHaveTextContent('false'))

    act(() => {
      screen.getByText('resume').click()
    })
    await waitFor(() => expect(screen.getByTestId('playing')).toHaveTextContent('true'))

    // A transient 'idle' mid-transition must not clear the optimistic resume.
    act(() => {
      es.emit('state', { type: 'state', queues: [queue('idle')] })
    })
    expect(screen.getByTestId('playing')).toHaveTextContent('true')

    // The server catching up to 'playing' clears the override — still true.
    act(() => {
      es.emit('state', { type: 'state', queues: [queue('playing')] })
    })
    await waitFor(() => expect(screen.getByTestId('playing')).toHaveTextContent('true'))
  })
})

describe('MusicProvider connection recovery', () => {
  class FakeEventSource {
    static instances: FakeEventSource[] = []
    url: string
    onopen: (() => void) | null = null
    onerror: (() => void) | null = null
    closed = false
    constructor(url: string) {
      this.url = url
      FakeEventSource.instances.push(this)
    }
    addEventListener() {}
    close() {
      this.closed = true
    }
  }

  beforeEach(() => {
    FakeEventSource.instances = []
    musicStateFixtureFor.mockReturnValue(undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ 'music.service_url': 'http://192.168.1.42:8095/' }),
      }),
    )
    vi.stubGlobal('EventSource', FakeEventSource)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    musicStateFixtureFor.mockReset()
    vi.resetModules()
  })

  // Renders with real timers so the async `isConfigured` flip (which depends
  // on the mocked config `fetch` resolving) can be awaited normally, then
  // hands back the first connection for the caller to switch to fake timers.
  async function renderProvider() {
    const { MusicProvider, useMusic } = await freshMusicModules()
    render(
      wrapInQueryClient(
        <MusicProvider>
          <MusicProbe useMusic={useMusic} />
        </MusicProvider>,
      ),
    )
    await waitFor(() => expect(FakeEventSource.instances.length).toBe(1))
    return FakeEventSource.instances[0]
  }

  it('closes the dead connection on error and reconnects once the backoff elapses', async () => {
    const first = await renderProvider()
    vi.useFakeTimers()

    act(() => {
      first.onerror?.()
    })
    expect(first.closed).toBe(true)
    expect(FakeEventSource.instances.length).toBe(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(999)
    })
    expect(FakeEventSource.instances.length).toBe(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(FakeEventSource.instances.length).toBe(2)
    expect(FakeEventSource.instances[1].url).toBe('/api/music/events')
  })

  it('doubles the backoff on each consecutive failure', async () => {
    const first = await renderProvider()
    vi.useFakeTimers()

    act(() => {
      first.onerror?.()
    })
    // First reconnect fires at the base delay (1000ms).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(FakeEventSource.instances.length).toBe(2)
    const second = FakeEventSource.instances[1]

    act(() => {
      second.onerror?.()
    })
    // The second consecutive failure must wait the doubled delay (2000ms) —
    // not yet reconnected just short of it.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1999)
    })
    expect(FakeEventSource.instances.length).toBe(2)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(FakeEventSource.instances.length).toBe(3)
  })

  it('reconnects immediately on visibilitychange while disconnected, without waiting for backoff', async () => {
    const first = await renderProvider()
    vi.useFakeTimers()
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })

    act(() => {
      first.onerror?.()
    })
    expect(FakeEventSource.instances.length).toBe(1)

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(FakeEventSource.instances.length).toBe(2)

    // The pending backoff timer from the earlier error was cancelled by the
    // wake-triggered reconnect — letting time pass doesn't spawn a third
    // connection from it.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(FakeEventSource.instances.length).toBe(2)
  })

  it('resets the backoff to base after a successful open', async () => {
    const first = await renderProvider()
    vi.useFakeTimers()

    act(() => {
      first.onerror?.()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(FakeEventSource.instances.length).toBe(2)
    const second = FakeEventSource.instances[1]

    act(() => {
      second.onopen?.()
    })
    act(() => {
      second.onerror?.()
    })

    // Backoff should be back at the base delay, not doubled again.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(999)
    })
    expect(FakeEventSource.instances.length).toBe(2)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(FakeEventSource.instances.length).toBe(3)
  })
})

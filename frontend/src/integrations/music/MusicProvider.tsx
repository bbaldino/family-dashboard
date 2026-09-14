import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useIntegrationConfig } from '@/platform'
import { activeScenario } from '@/lib/scenario'
import { musicIntegration } from './config'
import type { MusicState, QueueState } from './types'
import { MusicContext, defaultContextValue } from './music-context'
import type { MusicActionError, MusicContextValue, PlayOptions, PlayPending } from './music-context'
import { musicStateFixtureFor } from './fixtures'
import { anchorGroupLabel, deriveActiveQueue, resolveAnchorGroup } from './anchor'
import { useAnchorId } from './useAnchorId'
import { useGroupTopology } from './usePlayers'

/**
 * Queue-state fixture for the active scenario, computed once at module load
 * — `activeScenario` itself never changes at runtime (see `@/lib/scenario`)
 * — so every render sees the same reference and the SSE-connection effect
 * below doesn't need it as a dependency. `undefined` when no scenario is
 * active or it doesn't define a music fixture, in which case the provider
 * connects to Music Assistant's real event stream exactly as before.
 *
 * This is the one place a fixture reaches `useMusic`: its state normally
 * arrives over SSE, not a poll, so there's no per-hook queryFn to
 * short-circuit the way the other music hooks do. Instead, when a fixture
 * is defined, it seeds `queues` directly and the SSE effect below never
 * opens a connection — the rest of the provider (the elapsed-time tick,
 * `deriveActiveQueue`, the context shape) runs unmodified over that seeded
 * state, so `useMusic` consumers can't tell the difference.
 */
const fixtureQueues: QueueState[] | undefined = musicStateFixtureFor(activeScenario)

interface MusicProviderProps {
  children: ReactNode
}

export function MusicProvider({ children }: MusicProviderProps) {
  const config = useIntegrationConfig(musicIntegration)
  const isConfigured = Boolean(config?.service_url) || fixtureQueues !== undefined

  // The panel's own room, and who it's currently grouped with. Both screens'
  // notion of "now playing" is the anchor's group, not the house's — see
  // `anchor.ts`. `useGroupTopology` deliberately doesn't poll; its own
  // comment says why, and what that costs.
  const anchorId = useAnchorId()
  const { data: players } = useGroupTopology(isConfigured)

  const [queues, setQueues] = useState<QueueState[]>(() => fixtureQueues ?? [])
  // A fixture is "connected" from the start — there's no handshake to wait
  // on — so seed this at init rather than setState-ing it inside the effect
  // below (which would just be replaying the initializer synchronously).
  const [isConnected, setIsConnected] = useState(() => fixtureQueues !== undefined)
  const [optimisticPlaying, setOptimisticPlaying] = useState<boolean | null>(null)
  const [actionError, setActionError] = useState<MusicActionError | null>(null)
  const [playPending, setPlayPending] = useState<PlayPending | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const volumeLockUntilRef = useRef<number>(0)

  const dismissError = useCallback(() => setActionError(null), [])

  useEffect(() => {
    if (!isConfigured) return

    if (fixtureQueues) {
      // A scenario fixture supplies queue state directly — no SSE connection.
      // `queues` and `isConnected` are already seeded from it above.
      return
    }

    // Reconnection state for this effect instance. Native EventSource retry
    // permanently gives up once a reconnect attempt gets back an HTTP error
    // status (per the SSE spec it goes to CLOSED and never retries again), so
    // we manage the close-then-reconnect cycle ourselves instead of relying
    // on it. `cancelled` guards every closure below against firing after
    // this effect has torn down (e.g. a queued reconnect racing unmount).
    let cancelled = false
    let connected = false
    const baseDelay = 1000
    const maxDelay = 30000
    let backoffDelay = baseDelay
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }

    const connect = () => {
      if (cancelled) return

      const es = new EventSource('/api/music/events')
      esRef.current = es

      es.addEventListener('state', (e: MessageEvent) => {
        const data = JSON.parse(e.data) as
          { type: 'state'; queues: QueueState[] } | { type: 'queueUpdated'; queue: QueueState }

        const preserveVolume = Date.now() < volumeLockUntilRef.current

        // Only clear the optimistic play/pause override when the server reports
        // a definitive playing or paused state. Sonos often reports 'idle' during
        // transitions, so clearing on idle would snap the button back prematurely.
        const incomingQueues = data.type === 'state' ? data.queues : null
        if (incomingQueues) {
          const hasDefinitiveState = incomingQueues.some(
            (q) => q.state === 'playing' || q.state === 'paused',
          )
          if (hasDefinitiveState) {
            setOptimisticPlaying(null)
          }
        }

        if (data.type === 'state') {
          if (preserveVolume) {
            // Keep optimistic volume levels during the lock window
            setQueues((prev) => {
              const volumeMap = new Map(prev.map((q) => [q.queueId, q.volumeLevel]))
              return data.queues.map((q) => ({
                ...q,
                volumeLevel: volumeMap.get(q.queueId) ?? q.volumeLevel,
              }))
            })
          } else {
            setQueues(data.queues)
          }
          setIsConnected(true)
        } else if (data.type === 'queueUpdated') {
          setQueues((prev) => {
            const idx = prev.findIndex((q) => q.queueId === data.queue.queueId)
            const queue =
              preserveVolume && idx !== -1
                ? { ...data.queue, volumeLevel: prev[idx].volumeLevel }
                : data.queue
            if (idx === -1) return [...prev, queue]
            const next = [...prev]
            next[idx] = queue
            return next
          })
        }
      })

      es.onopen = () => {
        backoffDelay = baseDelay
        connected = true
        setIsConnected(true)
      }

      es.onerror = () => {
        connected = false
        setIsConnected(false)
        // Don't rely on the browser's native retry — explicitly close and
        // schedule our own reconnect with exponential backoff.
        es.close()
        if (cancelled) return
        clearReconnectTimer()
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          connect()
        }, backoffDelay)
        backoffDelay = Math.min(backoffDelay * 2, maxDelay)
      }
    }

    connect()

    // Tablet-wake recovery: when the screen comes back from sleep/background
    // or the network comes back online, don't wait out a possibly-long
    // backoff — reconnect right away if we're not already connected.
    const reconnectNow = () => {
      if (cancelled || connected) return
      clearReconnectTimer()
      backoffDelay = baseDelay
      connect()
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') reconnectNow()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', reconnectNow)

    return () => {
      cancelled = true
      clearReconnectTimer()
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', reconnectNow)
      esRef.current?.close()
      esRef.current = null
      setIsConnected(false)
    }
  }, [isConfigured])

  // Client-side tick: increment elapsed on the active queue's current item while playing
  useEffect(() => {
    if (!isConfigured) return

    const id = setInterval(() => {
      setQueues((prev) => {
        const playingIdx = prev.findIndex((q) => q.state === 'playing')
        if (playingIdx === -1) return prev
        const q = prev[playingIdx]
        if (!q.currentItem || q.currentItem.elapsed === null) return prev
        const { elapsed, duration } = q.currentItem
        const nextElapsed =
          typeof duration === 'number' ? Math.min(elapsed + 1, duration) : elapsed + 1
        const updated: QueueState = {
          ...q,
          currentItem: { ...q.currentItem, elapsed: nextElapsed },
        }
        const next = [...prev]
        next[playingIdx] = updated
        return next
      })
    }, 1000)

    return () => clearInterval(id)
  }, [isConfigured])

  /**
   * Runs a transport action and records a failure instead of letting the
   * rejection escape. No call site awaits these — `onTap={() => play(...)}` and
   * friends — so a rejection previously became an unhandled promise rejection
   * and the screen showed nothing at all: a failed tap and an ignored tap were
   * indistinguishable. A track that Music Assistant returned 500 for on every
   * attempt therefore just looked dead.
   *
   * Swallowing rather than rethrowing is deliberate: nothing upstream is in a
   * position to handle it, and rethrowing only restores the unhandled
   * rejection. The error becomes visible UI state, which is the thing that was
   * missing.
   */
  const runAction = useCallback(async (describe: string, action: () => Promise<unknown>) => {
    try {
      await action()
    } catch (err) {
      console.error(`music: ${describe} failed`, err)
      setActionError({ message: describe, at: Date.now() })
    }
  }, [])

  const play = useCallback(
    async (uri: string, options?: PlayOptions) => {
      // The item's own name when we have it — "Couldn’t play “Go”." tells you
      // which tap died, which matters on a shelf where every card looks alike.
      const what = options?.name ? `“${options.name}”` : 'that'
      // Acknowledge the tap at once. The play_media round-trip can run to a
      // noticeable pause (a radio attempt, its fallback when the station
      // can't be built, then a log lookup), and without this the gap between
      // a tap and the first sound is silent — the tap reads as ignored. A
      // fresh cue also supersedes any stale failure notice still on screen.
      setActionError(null)
      setPlayPending({ label: what, at: Date.now() })
      try {
        await runAction(`Couldn’t play ${what}`, () =>
          musicIntegration.api.post('/play', {
            uri,
            radio: options?.radio,
            enqueue_mode: options?.enqueueMode,
            media_type: options?.mediaType,
            name: options?.name,
            artist: options?.artist,
            artist_uri: options?.artistUri,
            album: options?.album,
            album_uri: options?.albumUri,
            image_url: options?.imageUrl,
          }),
        )
      } finally {
        setPlayPending(null)
      }
    },
    [runAction],
  )

  const pause = useCallback(async () => {
    setOptimisticPlaying(false)
    await runAction('Couldn’t pause', () => musicIntegration.api.post('/pause', {}))
  }, [runAction])

  const resume = useCallback(async () => {
    setOptimisticPlaying(true)
    await runAction('Couldn’t resume', () => musicIntegration.api.post('/resume', {}))
  }, [runAction])

  const stop = useCallback(async () => {
    await runAction('Couldn’t stop', () => musicIntegration.api.post('/stop', {}))
  }, [runAction])

  const next = useCallback(async () => {
    await runAction('Couldn’t skip forward', () => musicIntegration.api.post('/next', {}))
  }, [runAction])

  const previous = useCallback(async () => {
    await runAction('Couldn’t skip back', () => musicIntegration.api.post('/previous', {}))
  }, [runAction])

  const setVolume = useCallback(
    async (playerId: string, level: number) => {
      // Optimistic update + lock: prevent SSE from overwriting for 2 seconds
      volumeLockUntilRef.current = Date.now() + 2000
      setQueues((prev) =>
        prev.map((q) => (q.queueId === playerId ? { ...q, volumeLevel: level } : q)),
      )
      await runAction('Couldn’t change the volume', () =>
        musicIntegration.api.post('/volume', { player_id: playerId, level }),
      )
    },
    [runAction],
  )

  if (!isConfigured) {
    return <MusicContext.Provider value={defaultContextValue}>{children}</MusicContext.Provider>
  }

  const activeQueue = deriveActiveQueue(queues, players ?? [], anchorId)
  const state: MusicState = { queues, activeQueue }
  const isPlaying = optimisticPlaying ?? activeQueue?.state === 'playing'
  // The room to *name* is the anchor's group, which under grouping is not
  // the queue owner's own name: a Kitchen+Deck group led by the Deck plays
  // the Deck's queue, but the panel is still standing in the Kitchen.
  const anchorRoomLabel = anchorGroupLabel(resolveAnchorGroup(players ?? [], anchorId).members)

  const contextValue: MusicContextValue = {
    state,
    anchorRoomLabel,
    isPlaying,
    isConnected,
    actionError,
    dismissError,
    playPending,
    play,
    pause,
    resume,
    stop,
    next,
    previous,
    setVolume,
  }

  return <MusicContext.Provider value={contextValue}>{children}</MusicContext.Provider>
}

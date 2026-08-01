import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useIntegrationConfig } from '@/data/use-integration-config'
import { activeScenario } from '@/data/scenario'
import { musicIntegration } from './config'
import type { MusicState, QueueState } from './types'
import { MusicContext, defaultContextValue } from './music-context'
import type { MusicContextValue, PlayOptions } from './music-context'
import { musicStateFixtureFor } from './fixtures'

/**
 * Queue-state fixture for the active scenario, computed once at module load
 * — `activeScenario` itself never changes at runtime (see `@/data/scenario`)
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

function deriveActiveQueue(queues: QueueState[], defaultPlayerId?: string): QueueState | null {
  // Playing or paused — unambiguous
  const active =
    queues.find((q) => q.state === 'playing') ??
    queues.find((q) => q.state === 'paused')
  if (active) return active

  // Idle with a current item — prefer the default player to avoid showing
  // a stale track from a different speaker
  const idleWithItem = queues.filter((q) => q.state === 'idle' && q.currentItem != null)
  if (defaultPlayerId) {
    const defaultQueue = idleWithItem.find((q) => q.queueId === defaultPlayerId)
    if (defaultQueue) return defaultQueue
  }
  return idleWithItem[0] ?? null
}

interface MusicProviderProps {
  children: ReactNode
}

export function MusicProvider({ children }: MusicProviderProps) {
  const config = useIntegrationConfig(musicIntegration)
  const isConfigured = Boolean(config?.service_url) || fixtureQueues !== undefined

  const [queues, setQueues] = useState<QueueState[]>(() => fixtureQueues ?? [])
  // A fixture is "connected" from the start — there's no handshake to wait
  // on — so seed this at init rather than setState-ing it inside the effect
  // below (which would just be replaying the initializer synchronously).
  const [isConnected, setIsConnected] = useState(() => fixtureQueues !== undefined)
  const [optimisticPlaying, setOptimisticPlaying] = useState<boolean | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const volumeLockUntilRef = useRef<number>(0)

  useEffect(() => {
    if (!isConfigured) return

    if (fixtureQueues) {
      // A scenario fixture supplies queue state directly — no SSE connection.
      // `queues` and `isConnected` are already seeded from it above.
      return
    }

    const es = new EventSource('/api/music/events')
    esRef.current = es

    es.addEventListener('state', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as
        | { type: 'state'; queues: QueueState[] }
        | { type: 'queueUpdated'; queue: QueueState }

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
          const queue = preserveVolume && idx !== -1
            ? { ...data.queue, volumeLevel: prev[idx].volumeLevel }
            : data.queue
          if (idx === -1) return [...prev, queue]
          const next = [...prev]
          next[idx] = queue
          return next
        })
      }
    })

    es.onerror = () => {
      setIsConnected(false)
    }

    return () => {
      es.close()
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
        const updated: QueueState = {
          ...q,
          currentItem: { ...q.currentItem, elapsed: q.currentItem.elapsed + 1 },
        }
        const next = [...prev]
        next[playingIdx] = updated
        return next
      })
    }, 1000)

    return () => clearInterval(id)
  }, [isConfigured])

  const play = useCallback(async (uri: string, options?: PlayOptions) => {
    await musicIntegration.api.post('/play', {
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
    })
  }, [])

  const pause = useCallback(async () => {
    setOptimisticPlaying(false)
    await musicIntegration.api.post('/pause', {})
  }, [])

  const resume = useCallback(async () => {
    setOptimisticPlaying(true)
    await musicIntegration.api.post('/resume', {})
  }, [])

  const stop = useCallback(async () => {
    await musicIntegration.api.post('/stop', {})
  }, [])

  const next = useCallback(async () => {
    await musicIntegration.api.post('/next', {})
  }, [])

  const previous = useCallback(async () => {
    await musicIntegration.api.post('/previous', {})
  }, [])

  const setVolume = useCallback(async (playerId: string, level: number) => {
    // Optimistic update + lock: prevent SSE from overwriting for 2 seconds
    volumeLockUntilRef.current = Date.now() + 2000
    setQueues((prev) =>
      prev.map((q) => (q.queueId === playerId ? { ...q, volumeLevel: level } : q)),
    )
    await musicIntegration.api.post('/volume', { player_id: playerId, level })
  }, [])

  if (!isConfigured) {
    return (
      <MusicContext.Provider value={defaultContextValue}>
        {children}
      </MusicContext.Provider>
    )
  }

  const activeQueue = deriveActiveQueue(queues, config?.default_player)
  const state: MusicState = { queues, activeQueue }
  const isPlaying = optimisticPlaying ?? activeQueue?.state === 'playing'

  const contextValue: MusicContextValue = {
    state,
    isPlaying,
    isConnected,
    play,
    pause,
    resume,
    stop,
    next,
    previous,
    setVolume,
  }

  return (
    <MusicContext.Provider value={contextValue}>
      {children}
    </MusicContext.Provider>
  )
}

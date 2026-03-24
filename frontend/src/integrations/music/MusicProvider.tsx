import { createContext, useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useIntegrationConfig } from '@/integrations/use-integration-config'
import { musicIntegration } from './config'
import type { MusicState, QueueState } from './types'

interface MusicContextValue {
  state: MusicState
  isPlaying: boolean
  isConnected: boolean
  play: (uri: string, radio?: boolean) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  stop: () => Promise<void>
  next: () => Promise<void>
  previous: () => Promise<void>
  setVolume: (playerId: string, level: number) => Promise<void>
}

const emptyState: MusicState = { queues: [], activeQueue: null }

const noOp = async () => {}

const defaultContextValue: MusicContextValue = {
  state: emptyState,
  isPlaying: false,
  isConnected: false,
  play: noOp,
  pause: noOp,
  resume: noOp,
  stop: noOp,
  next: noOp,
  previous: noOp,
  setVolume: noOp,
}

export const MusicContext = createContext<MusicContextValue | null>(null)

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
  const isConfigured = Boolean(config?.service_url)

  const [queues, setQueues] = useState<QueueState[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [optimisticPlaying, setOptimisticPlaying] = useState<boolean | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const volumeLockUntilRef = useRef<number>(0)

  useEffect(() => {
    if (!isConfigured) return

    const es = new EventSource('/api/music/events')
    esRef.current = es

    es.addEventListener('state', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as
        | { type: 'state'; queues: QueueState[] }
        | { type: 'queueUpdated'; queue: QueueState }

      const preserveVolume = Date.now() < volumeLockUntilRef.current
      setOptimisticPlaying(null) // Clear optimistic override when real state arrives

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

  const play = useCallback(async (uri: string, radio?: boolean) => {
    await musicIntegration.api.post('/play', { uri, radio })
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

import { createContext, useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useIntegrationConfig } from '@/integrations/use-integration-config'
import { musicIntegration } from './config'
import type { MusicState, QueueState } from './types'

interface MusicContextValue {
  state: MusicState
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

function deriveActiveQueue(queues: QueueState[]): QueueState | null {
  return (
    queues.find((q) => q.state === 'playing') ??
    queues.find((q) => q.state === 'paused') ??
    null
  )
}

interface MusicProviderProps {
  children: ReactNode
}

export function MusicProvider({ children }: MusicProviderProps) {
  const config = useIntegrationConfig(musicIntegration)
  const isConfigured = Boolean(config?.service_url)

  const [queues, setQueues] = useState<QueueState[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!isConfigured) return

    const es = new EventSource('/api/music/events')
    esRef.current = es

    es.addEventListener('state', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as
        | { type: 'state'; queues: QueueState[] }
        | { type: 'queueUpdated'; queue: QueueState }

      if (data.type === 'state') {
        setQueues(data.queues)
        setIsConnected(true)
      } else if (data.type === 'queueUpdated') {
        setQueues((prev) => {
          const idx = prev.findIndex((q) => q.queueId === data.queue.queueId)
          if (idx === -1) return [...prev, data.queue]
          const next = [...prev]
          next[idx] = data.queue
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
    await musicIntegration.api.post('/pause', {})
  }, [])

  const resume = useCallback(async () => {
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
    // Optimistic update: reflect the new volume immediately in the UI
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

  const activeQueue = deriveActiveQueue(queues)
  const state: MusicState = { queues, activeQueue }

  const contextValue: MusicContextValue = {
    state,
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

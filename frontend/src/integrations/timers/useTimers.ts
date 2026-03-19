import { useState, useEffect, useCallback, useRef } from 'react'
import type { Timer, TimerEvent } from './types'

/** Normalize a timer from the API: ensure remainingMs is always set */
function normalizeTimer(t: Timer): Timer {
  if (t.status === 'paused' && t.pausedRemainingMs != null) {
    return { ...t, remainingMs: t.pausedRemainingMs }
  }
  return t
}

export function useTimers(serviceUrl: string | undefined) {
  const [timers, setTimers] = useState<Timer[]>([])
  const [firedTimers, setFiredTimers] = useState<Timer[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)

  // SSE connection
  useEffect(() => {
    if (!serviceUrl) return

    const url = `${serviceUrl.replace(/\/$/, '')}/timers/events`
    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data: TimerEvent = JSON.parse(event.data)

        switch (data.type) {
          case 'snapshot':
            if (data.timers) {
              setTimers(data.timers.filter((t) => t.status === 'running' || t.status === 'paused').map(normalizeTimer))
            }
            break
          case 'created':
            if (data.timer) {
              const t = normalizeTimer(data.timer)
              setTimers((prev) => [...prev.filter((p) => p.id !== t.id), t])
            }
            break
          case 'fired':
            if (data.timer) {
              setTimers((prev) => prev.filter((p) => p.id !== data.timer!.id))
              setFiredTimers((prev) => [...prev, normalizeTimer(data.timer!)])
            }
            break
          case 'cancelled':
            if (data.timer) {
              setTimers((prev) => prev.filter((p) => p.id !== data.timer!.id))
            }
            break
          case 'paused':
            if (data.timer) {
              const t = normalizeTimer(data.timer)
              setTimers((prev) => prev.map((p) => (p.id === t.id ? t : p)))
            }
            break
          case 'resumed':
            if (data.timer) {
              const t = normalizeTimer(data.timer)
              setTimers((prev) => prev.map((p) => (p.id === t.id ? t : p)))
            }
            break
        }
      } catch {
        // Ignore parse errors
      }
    }

    es.onerror = () => {
      // EventSource auto-reconnects. On reconnect, the server sends a
      // fresh snapshot which resyncs everything.
    }

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [serviceUrl])

  // Local countdown tick — decrement remainingMs every second for running timers
  useEffect(() => {
    if (timers.length === 0) return

    const interval = setInterval(() => {
      setTimers((prev) =>
        prev.map((t) => {
          if (t.status !== 'running') return t
          const remaining = Math.max(0, t.remainingMs - 1000)
          return { ...t, remainingMs: remaining }
        }),
      )
    }, 1000)

    return () => clearInterval(interval)
  }, [timers.length])

  // Actions
  const baseUrl = serviceUrl?.replace(/\/$/, '')

  const pause = useCallback(
    async (id: string) => {
      if (!baseUrl) return
      await fetch(`${baseUrl}/timers/${id}/pause`, { method: 'POST' }).catch(() => {})
    },
    [baseUrl],
  )

  const resume = useCallback(
    async (id: string) => {
      if (!baseUrl) return
      await fetch(`${baseUrl}/timers/${id}/resume`, { method: 'POST' }).catch(() => {})
    },
    [baseUrl],
  )

  const cancel = useCallback(
    async (id: string) => {
      if (!baseUrl) return
      await fetch(`${baseUrl}/timers/${id}`, { method: 'DELETE' }).catch(() => {})
    },
    [baseUrl],
  )

  const dismiss = useCallback((id: string) => {
    setFiredTimers((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { timers, firedTimers, pause, resume, cancel, dismiss }
}

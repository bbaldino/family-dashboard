import { useState, useEffect, useCallback, useRef } from 'react'
import type { Timer, TimerEvent } from './types'
import { getAlarmById, DEFAULT_ALARM_ID } from './alarmSounds'

/** Normalize a timer from the API: ensure remainingMs is always set */
function normalizeTimer(t: Timer): Timer {
  let remaining = t.remainingMs

  if (t.status === 'paused' && t.pausedRemainingMs != null) {
    remaining = t.pausedRemainingMs
  }

  // If remainingMs is missing, compute from endsAt
  if (remaining == null || isNaN(remaining)) {
    if (t.endsAt) {
      remaining = Math.max(0, new Date(t.endsAt).getTime() - Date.now())
    } else {
      remaining = 0
    }
  }

  return { ...t, remainingMs: remaining }
}

export function useTimers(serviceUrl: string | undefined, alarmSoundId?: string) {
  const [timers, setTimers] = useState<Timer[]>([])
  const [firedTimers, setFiredTimers] = useState<Timer[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // SSE connection
  useEffect(() => {
    if (!serviceUrl) return

    const url = `${serviceUrl.replace(/\/$/, '')}/events`
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
              // Play alarm and start repeating every 5 seconds
              const alarm = getAlarmById(alarmSoundId ?? DEFAULT_ALARM_ID)
              try { alarm.play() } catch { /* audio unavailable */ }
              if (!alarmIntervalRef.current) {
                alarmIntervalRef.current = setInterval(() => {
                  try { alarm.play() } catch { /* audio unavailable */ }
                }, 5000)
              }
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
      await fetch(`${baseUrl}/${id}/pause`, { method: 'POST' }).catch(() => {})
    },
    [baseUrl],
  )

  const resume = useCallback(
    async (id: string) => {
      if (!baseUrl) return
      await fetch(`${baseUrl}/${id}/resume`, { method: 'POST' }).catch(() => {})
    },
    [baseUrl],
  )

  const cancel = useCallback(
    async (id: string) => {
      if (!baseUrl) return
      await fetch(`${baseUrl}/${id}`, { method: 'DELETE' }).catch(() => {})
    },
    [baseUrl],
  )

  const dismiss = useCallback((id: string) => {
    setFiredTimers((prev) => {
      const remaining = prev.filter((t) => t.id !== id)
      // Stop repeating alarm if no more fired timers
      if (remaining.length === 0 && alarmIntervalRef.current) {
        clearInterval(alarmIntervalRef.current)
        alarmIntervalRef.current = null
      }
      return remaining
    })
  }, [])

  return { timers, firedTimers, pause, resume, cancel, dismiss }
}

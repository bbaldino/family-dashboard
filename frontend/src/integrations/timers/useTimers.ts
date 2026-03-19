import { useState, useEffect, useCallback, useRef } from 'react'
import type { Timer, TimerEvent } from './types'
import { startRepeatingAlarm } from './alarmSounds'

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
  const stopAlarmRef = useRef<(() => void) | null>(null)

  // SSE connection
  useEffect(() => {
    if (!serviceUrl) return

    const url = `${serviceUrl.replace(/\/$/, '')}/events`
    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data: TimerEvent = JSON.parse(event.data)
        console.log('[timers] SSE event:', data.type, data.timer?.id, data.timer?.status)

        switch (data.type) {
          case 'snapshot':
            if (data.timers) {
              setTimers(data.timers.filter((t) => t.status === 'running' || t.status === 'paused').map(normalizeTimer))
              // Clear any fired timers that are no longer in the snapshot
              // (they've been dismissed/cancelled on the server side)
              const activeIds = new Set(data.timers.map((t) => t.id))
              setFiredTimers((prev) => {
                const remaining = prev.filter((t) => activeIds.has(t.id))
                if (remaining.length === 0 && prev.length > 0 && stopAlarmRef.current) {
                  stopAlarmRef.current()
                  stopAlarmRef.current = null
                }
                return remaining
              })
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
              // Stop any existing alarm, start a new one
              if (stopAlarmRef.current) {
                stopAlarmRef.current()
              }
              stopAlarmRef.current = startRepeatingAlarm(alarmSoundId ?? 'gentle-chime')
            }
            break
          case 'cancelled':
            if (data.timer) {
              const cancelledId = data.timer.id
              console.log('[timers] cancelled event for:', cancelledId)
              setTimers((prev) => prev.filter((p) => p.id !== cancelledId))
              setFiredTimers((prev) => {
                const remaining = prev.filter((t) => t.id !== cancelledId)
                console.log('[timers] firedTimers before:', prev.length, 'after:', remaining.length, 'stopAlarmRef:', !!stopAlarmRef.current)
                if (remaining.length < prev.length && stopAlarmRef.current) {
                  console.log('[timers] stopping alarm!')
                  stopAlarmRef.current()
                  stopAlarmRef.current = null
                }
                return remaining
              })
            }
            break
          case 'dismissed':
            if (data.timer) {
              const dismissedId = data.timer.id
              console.log('[timers] dismissed event for:', dismissedId, 'stopAlarmRef:', !!stopAlarmRef.current)
              // Stop alarm immediately regardless of firedTimers state
              if (stopAlarmRef.current) {
                console.log('[timers] stopping alarm via dismissed!')
                stopAlarmRef.current()
                stopAlarmRef.current = null
              } else {
                console.log('[timers] WARNING: stopAlarmRef was null, cannot stop alarm')
              }
              setFiredTimers((prev) => prev.filter((t) => t.id !== dismissedId))
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
      // Stop alarm if no more fired timers
      if (remaining.length === 0 && stopAlarmRef.current) {
        stopAlarmRef.current()
        stopAlarmRef.current = null
      }
      return remaining
    })
  }, [])

  return { timers, firedTimers, pause, resume, cancel, dismiss }
}

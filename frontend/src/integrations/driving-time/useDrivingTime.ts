import { useState, useEffect, useRef, useCallback } from 'react'
import { drivingTimeIntegration } from './config'
import type { CalendarEvent } from '@/integrations/google-calendar/types'
import type { DrivingTimeResult, EventDriveInfo, DriveUrgency } from './types'

function computeUrgency(minutesUntilLeave: number): DriveUrgency {
  if (minutesUntilLeave > 30) return 'ok'
  if (minutesUntilLeave > 5) return 'soon'
  return 'urgent'
}

function computeDisplayText(urgency: DriveUrgency, durationText: string, minutesUntilLeave: number): string {
  if (urgency === 'ok') return `${durationText} drive`
  if (urgency === 'urgent') return 'Leave now!'
  return `Leave in ${Math.max(0, Math.round(minutesUntilLeave))} min`
}

/** Compute refresh interval (ms) based on time until nearest event */
function computeRefreshInterval(events: CalendarEvent[]): number {
  const now = Date.now()
  let nearestMinutes = Infinity

  for (const e of events) {
    const start = e.start.dateTime ?? e.start.date
    if (!start) continue
    const mins = (new Date(start).getTime() - now) / 60000
    if (mins > 0 && mins < nearestMinutes) nearestMinutes = mins
  }

  if (nearestMinutes > 120) return 30 * 60000
  if (nearestMinutes > 60) return 15 * 60000
  if (nearestMinutes > 30) return 10 * 60000
  return 5 * 60000
}

export function useDrivingTime(events: CalendarEvent[]) {
  const [driveInfo, setDriveInfo] = useState<Record<string, EventDriveInfo>>({})
  const [fetchTick, setFetchTick] = useState(0)

  // Filter to events within 24 hours with a location
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const relevantEvents = events.filter((e) => {
    if (!e.location) return false
    const start = e.start.dateTime ?? e.start.date
    if (!start) return false
    const startDate = new Date(start)
    return startDate > now && startDate < tomorrow
  })

  const relevantKey = relevantEvents.map((e) => e.id).join(',')

  const updateDriveInfo = useCallback(
    (destination: string, durationSecs: number, durationText: string, bufferMinutes: number) => {
      const bufferMs = bufferMinutes * 60 * 1000
      const durationMs = durationSecs * 1000

      setDriveInfo((prev) => {
        const next = { ...prev }
        for (const event of relevantEvents) {
          if (event.location !== destination) continue
          const start = event.start.dateTime ?? event.start.date
          if (!start) continue
          const startDate = new Date(start)
          const leaveByTime = new Date(startDate.getTime() - durationMs - bufferMs)
          const minutesUntilLeave = (leaveByTime.getTime() - Date.now()) / 60000
          const urgency = computeUrgency(minutesUntilLeave)
          next[event.id] = {
            durationSeconds: durationSecs,
            durationText,
            leaveByTime,
            minutesUntilLeave,
            urgency,
            displayText: computeDisplayText(urgency, durationText, minutesUntilLeave),
          }
        }
        return next
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [relevantKey],
  )

  // Fetch driving times for unique destinations (serialized)
  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      const destinations = new Map<string, string>()

      for (const event of relevantEvents) {
        const dest = event.location!
        const start = event.start.dateTime ?? event.start.date ?? ''
        // Keep the earliest event start for each destination
        if (!destinations.has(dest) || start < destinations.get(dest)!) {
          destinations.set(dest, start)
        }
      }

      for (const [destination] of destinations) {
        if (cancelled) break

        try {
          const params = new URLSearchParams({ destination })

          const result = await drivingTimeIntegration.api.get<DrivingTimeResult>(
            `?${params.toString()}`,
          )

          if (result.durationSeconds != null && result.durationText != null) {
            updateDriveInfo(destination, result.durationSeconds, result.durationText, result.bufferMinutes)
          }
        } catch {
          // Don't block other destinations on failure
        }
      }
    }

    if (relevantEvents.length > 0) {
      fetchAll()
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relevantKey, fetchTick, updateDriveInfo])

  // Adaptive polling: refresh driving times based on proximity to nearest event
  useEffect(() => {
    if (relevantEvents.length === 0) return

    const intervalMs = computeRefreshInterval(relevantEvents)
    const timer = setInterval(() => {
      setFetchTick((t) => t + 1)
    }, intervalMs)

    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relevantKey])

  // Recalculate urgency every minute (countdown text updates without refetching)
  useEffect(() => {
    const interval = setInterval(() => {
      setDriveInfo((prev) => {
        const next = { ...prev }
        for (const [id, info] of Object.entries(next)) {
          const minutesUntilLeave = (info.leaveByTime.getTime() - Date.now()) / 60000
          const urgency = computeUrgency(minutesUntilLeave)
          next[id] = {
            ...info,
            minutesUntilLeave,
            urgency,
            displayText: computeDisplayText(urgency, info.durationText, minutesUntilLeave),
          }
        }
        return next
      })
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  return driveInfo
}

import { useState, useEffect, useRef } from 'react'
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

export function useDrivingTime(events: CalendarEvent[]) {
  const [driveInfo, setDriveInfo] = useState<Record<string, EventDriveInfo>>({})
  const fetchedRef = useRef<Set<string>>(new Set())

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

  // Fetch driving times for unique destinations (serialized)
  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      const destinations = new Map<string, { event: CalendarEvent; startTime: string }>()

      for (const event of relevantEvents) {
        const dest = event.location!
        const start = event.start.dateTime ?? event.start.date ?? ''
        // Keep the earliest event start for each destination
        if (!destinations.has(dest) || start < destinations.get(dest)!.startTime) {
          destinations.set(dest, { event, startTime: start })
        }
      }

      for (const [destination, { startTime }] of destinations) {
        if (cancelled) break
        if (fetchedRef.current.has(destination)) continue

        try {
          const params = new URLSearchParams({ destination })
          if (startTime) params.set('event_start', new Date(startTime).toISOString())

          const result = await drivingTimeIntegration.api.get<DrivingTimeResult>(
            `?${params.toString()}`,
          )

          if (result.durationSeconds != null && result.durationText != null) {
            const durationSecs = result.durationSeconds
            const bufferMs = result.bufferMinutes * 60 * 1000
            const durationMs = durationSecs * 1000

            // Update drive info for all events with this destination
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
                  durationText: result.durationText!,
                  leaveByTime,
                  minutesUntilLeave,
                  urgency,
                  displayText: computeDisplayText(urgency, result.durationText!, minutesUntilLeave),
                }
              }
              return next
            })
          }

          fetchedRef.current.add(destination)
        } catch {
          fetchedRef.current.add(destination) // Don't retry failures
        }
      }
    }

    fetchAll()
    return () => { cancelled = true }
  }, [relevantEvents.map((e) => e.id).join(',')])

  // Recalculate urgency every minute
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

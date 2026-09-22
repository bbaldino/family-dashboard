import { useEffect, useState } from 'react'
import type { Visit } from './types'

type RawVisit = {
  id: string
  start: number
  end: number
  count: number
  clip_event_ids: string[]
  snapshot_event_id: string
  duration_s: number
}

export function useDoorbellToday(): { visits: Visit[]; loading: boolean; error: boolean } {
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    // The effect runs once (empty deps), and the initial state above is
    // already `loading: true, error: false`, so there's nothing to reset here
    // — resetting synchronously in the effect body trips
    // react-hooks/set-state-in-effect. Only the async fetch settles state.
    let cancelled = false
    fetch('/api/cameras/doorbell/today')
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json()
      })
      .then((data: { visits: RawVisit[] }) => {
        if (cancelled) return
        setVisits(
          (data.visits ?? []).map((v) => ({
            id: v.id,
            start: v.start,
            end: v.end,
            count: v.count,
            clipEventIds: v.clip_event_ids,
            snapshotEventId: v.snapshot_event_id,
            durationS: v.duration_s,
          })),
        )
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError(true)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { visits, loading, error }
}

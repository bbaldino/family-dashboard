import { useEffect, useState } from 'react'

/** Current time, refreshed every 30s — enough for a wall clock, cheap enough to ignore. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

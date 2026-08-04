import { useQuery } from '@tanstack/react-query'

export const CONFIG_QUERY_KEY = ['config'] as const

/**
 * The single fetch of `/api/config` for the whole app.
 *
 * Every consumer previously ran its own raw `useEffect` + `fetch`: measured at
 * **11 requests on one page load** of Home, each returning the entire config
 * table. One query key fixes the fetch fan-out — react-query dedupes the
 * concurrent mounts, and invalidating this key updates every consumer at once.
 *
 * There are 10 independent places config gets written (`SettingsAdmin` plus
 * nine per-integration `SettingsComponent`s, each with its own save handler),
 * plus direct edits to `/api/config/<key>` outside the app entirely. None of
 * them call `invalidateQueries`, and the tablet this app runs on never
 * refocuses or remounts (`refetchOnWindowFocus: false` in `App.tsx` — it's a
 * wall-mounted kiosk stuck on one page), so a poll is what actually closes the
 * loop: `refetchInterval` guarantees every consumer sees a config change
 * within 60s, with no reload and no per-save-handler wiring.
 */
export function useAllConfig() {
  return useQuery({
    queryKey: CONFIG_QUERY_KEY,
    queryFn: async (): Promise<Record<string, string>> => {
      const resp = await fetch('/api/config')
      if (!resp.ok) throw new Error(`config fetch failed: ${resp.status}`)
      return resp.json()
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

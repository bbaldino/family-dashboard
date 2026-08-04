import { useQuery } from '@tanstack/react-query'

export const CONFIG_QUERY_KEY = ['config']

/**
 * The single fetch of `/api/config` for the whole app.
 *
 * Every consumer previously ran its own raw `useEffect` + `fetch`: measured at
 * **11 requests on one page load** of Home, each returning the entire config
 * table. They also never refetched, so a settings edit needed a page reload to
 * take effect. One query key fixes both — react-query dedupes the concurrent
 * mounts, and invalidating this key updates every consumer at once.
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
  })
}

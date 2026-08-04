import { useQuery } from '@tanstack/react-query'

export const CONFIG_QUERY_KEY = ['config'] as const

/**
 * The single shared fetch of `/api/config`, backing `useIntegrationConfig`.
 *
 * Before this, every `useIntegrationConfig` consumer ran its own raw
 * `useEffect` + `fetch`, each pulling the entire config table. One query key
 * fixes that fan-out for those consumers — react-query dedupes the
 * concurrent mounts, and invalidating this key updates all of them at once.
 *
 * This does not cover every place the app reads `/api/config`, though: five
 * call sites still do their own raw `useEffect` + `fetch('/api/config')`
 * outside this query, and none of them refetch —
 * `src/shell/ThemeMount.tsx`, `src/palettes/useTheme.ts` (so a theme change
 * still needs a reload), `src/themes/grid/screens/HomeBoard.tsx` (two call
 * sites), and `src/themes/grid/widgets/timers/TimerBanner.tsx`. Migrating
 * those onto this hook is follow-up work, not done here.
 *
 * There are 10 independent places config gets written (`SettingsAdmin` plus
 * nine per-integration `SettingsComponent`s, each with its own save handler),
 * plus direct edits to `/api/config/<key>` outside the app entirely. None of
 * them call `invalidateQueries`, and the tablet this app runs on never
 * refocuses or remounts (`refetchOnWindowFocus: false` in `App.tsx` — it's a
 * wall-mounted kiosk stuck on one page), so a poll is what actually closes
 * the loop for the consumers this hook does cover: `refetchInterval`
 * guarantees they see a config change within 60s, with no reload and no
 * per-save-handler wiring.
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

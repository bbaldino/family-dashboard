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
 * This does not cover every place the app reads `/api/config`, though. Each
 * admin `SettingsComponent` registered in `settingsRegistry` also does its
 * own raw fetch, but that is a different, one-shot pattern (load current
 * values once to prefill a form) and out of scope for this hook. Outside
 * that registry, four call sites across four files still do their own raw
 * `useEffect` + `fetch('/api/config')`, and none of them refetch —
 * `src/themes/grid/widgets/timers/TimerBanner.tsx`,
 * `src/themes/grid/screens/CamerasBoard.tsx`,
 * `src/themes/grid/overlays/doorbell/DoorbellRingListener.tsx`, and
 * `src/themes/grid/GridSettingsPanel.tsx` — the last one is the same
 * one-shot prefill pattern as a `SettingsComponent`, but it lives under
 * `src/themes/grid/` rather than the registry, so the exemption above
 * doesn't cover it either. (`src/themes/grid/screens/HomeBoard.tsx` used to
 * be two more call sites here; it now reads through this hook, as do the
 * google-calendar hooks — `fetchCalendarIds` was one more bypass until the
 * week strip and month grid started deriving their calendar ids from this
 * query, and it is gone. `src/palettes/useTheme.ts` and
 * `src/shell/ThemeMount.tsx` were two more — between them the reason a
 * theme or presentation change used to need a reload; both read through
 * this hook now.) Migrating the rest onto this hook is follow-up work, not
 * done here.
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
 *
 * `enabled` (default `true`) exists for `useIntegrationData`'s config-less
 * path: a config-less integration has nothing to read from `/api/config`, so
 * that hook always calls this hook (same hook, same order, every render —
 * required either way) but passes `enabled: false` for it, which skips the
 * fetch entirely rather than just declining to wait on it.
 */
export function useAllConfig(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: CONFIG_QUERY_KEY,
    queryFn: async (): Promise<Record<string, string>> => {
      const resp = await fetch('/api/config')
      if (!resp.ok) throw new Error(`config fetch failed: ${resp.status}`)
      return resp.json()
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: opts.enabled ?? true,
  })
}

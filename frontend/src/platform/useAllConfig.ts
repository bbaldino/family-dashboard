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
 * admin `SettingsComponent` registered in `settingsRegistry` still does its
 * own raw fetch. That is a different, one-shot pattern — load current values
 * once to prefill a form — and out of scope for this hook.
 *
 * Note that reading through this hook and *tracking* it are separate
 * choices. `src/themes/grid/GridSettingsPanel.tsx` (the same prefill pattern,
 * but under `src/themes/grid/` rather than the registry) reads this query and
 * then deliberately ignores every later value: a form's unsaved edits are
 * never in `/api/config`, so inputs derived from this query would discard
 * whatever someone had typed on the next poll tick. Any `SettingsComponent`
 * migrated here later wants that same shape — one shared request, prefill
 * once — not live values.
 *
 * Everything outside that registry now reads through this hook. It used to
 * be nine more raw fetches: two in `screens/HomeBoard.tsx`, one in
 * `fetchCalendarIds` (the google-calendar hooks derive their calendar ids
 * from this query instead, and it is gone), and six mount-only readers that
 * therefore needed a page reload to see a config change —
 * `palettes/useTheme.ts` and `shell/ThemeMount.tsx` (between them the reason
 * a theme or presentation change used to need one) plus grid's
 * `TimerBanner`, `CamerasBoard`, `DoorbellRingListener` and
 * `GridSettingsPanel`.
 *
 * Two of those — `CamerasBoard` and `DoorbellRingListener` — read this
 * query's raw data and coerce per key rather than going through
 * `useIntegrationConfig`, deliberately: one unparseable `doorbell.*` value
 * would otherwise take the whole integration's config to `null` (see that
 * hook), blanking the camera and the ring popup over an unrelated key.
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

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
 * Every place the app reads `/api/config` now goes through this hook,
 * including the admin `SettingsComponent` forms registered in
 * `settingsRegistry` (and `SettingsAdmin.tsx`'s own generic-field editor for
 * integrations without one). Those are a different consumption pattern from
 * everything else, though: a one-shot form prefill, not a live display.
 *
 * Reading through this hook and *tracking* it are separate choices. Every
 * settings form — `src/themes/grid/GridSettingsPanel.tsx` and the eight admin
 * forms under `src/admin/` (`SettingsAdmin`, `TimersSettings`,
 * `GoogleCalendarSettings`, `ThemePicker`, `MusicSettings`,
 * `DoorbellSettings`, `SportsSettings`, `CountdownsSettings`) — reads this
 * query and then deliberately ignores every later value: a form's unsaved
 * edits are never in `/api/config`, so inputs derived from this query would
 * discard whatever someone had typed on the next poll tick. Each is split
 * into an outer component that tracks the live query and re-renders on every
 * poll, and an inner form whose lazy `useState` initialisers read the config
 * it was mounted with once and ignore every later value — the inner never
 * remounts on a poll tick, only on a real navigation, so "once" is structural
 * rather than a flag that could be forgotten. Seeding state from a
 * `useEffect` instead is rejected by the `react-hooks/set-state-in-effect`
 * lint rule, which is why this shape exists rather than a simpler one.
 *
 * Everything else reads live and now goes through this hook too. It used to
 * be raw fetches in `screens/HomeBoard.tsx` (two), `fetchCalendarIds` (the
 * google-calendar hooks derive their calendar ids from this query instead,
 * and it is gone), `palettes/useTheme.ts` and `shell/ThemeMount.tsx` (between
 * them the reason a theme or presentation change used to need a page
 * reload), and grid's `TimerBanner`, `CamerasBoard` and
 * `DoorbellRingListener`.
 *
 * Two of those — `CamerasBoard` and `DoorbellRingListener` — read this
 * query's raw data and coerce per key rather than going through
 * `useIntegrationConfig`, deliberately: one unparseable `doorbell.*` value
 * would otherwise take the whole integration's config to `null` (see that
 * hook), blanking the camera and the ring popup over an unrelated key.
 *
 * Every save handler in the app now writes through `useSaveConfig`, which
 * invalidates this key, so an in-app change lands on every consumer at once
 * rather than up to 60s later.
 *
 * **`refetchInterval` is not redundant because of that, and must stay.** It
 * covers the writes no handler can announce: config is also edited outside
 * the app entirely — a direct `PUT`/`DELETE` to `/api/config/<key>` from a
 * shell, or a change made from a second browser — and nothing in this process
 * hears about those. The tablet this app runs on can't recover either way: it
 * never refocuses and never remounts (`refetchOnWindowFocus: false` in
 * `App.tsx` — it's a wall-mounted kiosk stuck on one page), so without the
 * poll an external edit would sit unseen until someone power-cycled the
 * thing. Invalidation makes in-app saves instant; this is the backstop for
 * everything else.
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

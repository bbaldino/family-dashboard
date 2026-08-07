import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAllConfig, useSaveConfig, CONFIG_QUERY_KEY, type ConfigWrite } from '@/platform'
import { BUILTIN_THEMES, EARTH_TONES } from './types'
import type { Theme } from './types'

const ACTIVE_KEY = 'theme.active'
const CUSTOM_KEY = 'theme.custom_themes'

function parseCustomThemes(raw: string | undefined): Theme[] {
  if (!raw) return []
  try {
    return JSON.parse(raw)
  } catch {
    // A corrupt custom-theme blob shouldn't take the whole palette down; the
    // built-ins are still perfectly usable without it.
    return []
  }
}

/**
 * The active palette, read through the shared `/api/config` query.
 *
 * This used to fetch `/api/config` itself, once, at mount — which is why
 * changing the theme has always needed a page reload: nothing ever re-read
 * the value. Going through `useAllConfig` means a theme change now lands
 * within that query's poll interval instead, on every consumer at once
 * (`ThemeMount` renders the whole dashboard inside these variables).
 *
 * The writer goes through `useSaveConfig`, which invalidates the shared query
 * on success — so the switch is confirmed against the server rather than
 * waiting a poll interval for it. It still seeds the cache optimistically
 * first: the invalidated refetch is a round trip, and the picker would look
 * dead for its duration otherwise. If the write fails the seed is put back
 * and the rejection reaches the caller, which is what `ThemeSettings` turns
 * into an error banner.
 */
export function useTheme() {
  const queryClient = useQueryClient()
  const { data } = useAllConfig()
  // `mutateAsync` is stable across renders; the result object it comes off is
  // not, so depending on the whole thing below would rebuild `writeConfig` —
  // and with it `setActiveTheme` — on every render of the dashboard.
  const { mutateAsync: saveConfig } = useSaveConfig()

  const customThemes = useMemo(() => parseCustomThemes(data?.[CUSTOM_KEY]), [data])
  const allThemes = useMemo(() => [...BUILTIN_THEMES, ...customThemes], [customThemes])
  const activeId = data?.[ACTIVE_KEY]
  const activeTheme = allThemes.find((t) => t.id === activeId) ?? EARTH_TONES

  /**
   * Writes the custom-theme list, the active id, or both.
   *
   * Both in one call is the point of the batch: creating a theme and
   * deleting one each change *both* keys from a single click, and two
   * mutations would mean two invalidations and two refetches of the whole
   * config table for one user action.
   *
   * Rejects when the write does. Callers must catch it — nothing else here
   * knows how this screen reports failure.
   */
  const savePalette = useCallback(
    async ({ themes, activeId }: { themes?: Theme[]; activeId?: string }) => {
      const writes: ConfigWrite[] = []
      if (themes !== undefined) writes.push({ key: CUSTOM_KEY, value: JSON.stringify(themes) })
      if (activeId !== undefined) writes.push({ key: ACTIVE_KEY, value: activeId })
      if (writes.length === 0) return

      // Seeded into the shared cache rather than held in local state, so
      // every config consumer sees the switch at once. A config fetch that
      // is already in flight would land on top of this and put the old value
      // back for one poll interval — cancelling it first isn't worth it: the
      // window is the few ms before the app's first config fetch resolves,
      // and `cancelQueries` provokes an immediate refetch that reintroduces
      // exactly the overwrite it was meant to prevent.
      const before = queryClient.getQueryData<Record<string, string>>(CONFIG_QUERY_KEY)
      queryClient.setQueryData<Record<string, string>>(CONFIG_QUERY_KEY, (prev) => ({
        ...(prev ?? {}),
        ...Object.fromEntries(writes.map((w) => [w.key, w.value as string])),
      }))

      try {
        await saveConfig(writes)
      } catch (err) {
        // A failed write invalidates nothing, so without this the seed above
        // would sit in the cache — the whole dashboard rendering a palette
        // the server rejected — until the next poll corrected it up to a
        // minute later. Only the keys this call touched are put back, so a
        // change that landed alongside it survives.
        queryClient.setQueryData<Record<string, string>>(CONFIG_QUERY_KEY, (prev) => {
          if (!prev) return prev
          const restored = { ...prev }
          for (const { key } of writes) {
            if (before && key in before) restored[key] = before[key]
            else delete restored[key]
          }
          return restored
        })
        throw err
      }
    },
    [queryClient, saveConfig],
  )

  return {
    activeTheme,
    allThemes,
    customThemes,
    savePalette,
  }
}

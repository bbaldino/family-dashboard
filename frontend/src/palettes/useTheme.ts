import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAllConfig, useSaveConfig, CONFIG_QUERY_KEY } from '@/platform'
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
 * Both writers go through `useSaveConfig`, which invalidates the shared query
 * on success — so the switch is confirmed against the server rather than
 * waiting a poll interval for it. They still seed the cache optimistically
 * first: the invalidated refetch is a round trip, and the picker would look
 * dead for its duration otherwise. If the write fails, that refetch never
 * happens and the next poll puts the stored value back.
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

  const writeConfig = useCallback(
    async (key: string, value: string) => {
      // Seeded into the shared cache rather than held in local state, so
      // every config consumer sees the switch at once. A config fetch that
      // is already in flight would land on top of this and put the old value
      // back for one poll interval — cancelling it first isn't worth it: the
      // window is the few ms before the app's first config fetch resolves,
      // and `cancelQueries` provokes an immediate refetch that reintroduces
      // exactly the overwrite it was meant to prevent.
      queryClient.setQueryData<Record<string, string>>(CONFIG_QUERY_KEY, (prev) => ({
        ...(prev ?? {}),
        [key]: value,
      }))
      await saveConfig({ key, value })
    },
    [queryClient, saveConfig],
  )

  const setActiveTheme = useCallback(
    (themeId: string) => writeConfig(ACTIVE_KEY, themeId),
    [writeConfig],
  )

  const saveCustomThemes = useCallback(
    (themes: Theme[]) => writeConfig(CUSTOM_KEY, JSON.stringify(themes)),
    [writeConfig],
  )

  return {
    activeTheme,
    allThemes,
    customThemes,
    setActiveTheme,
    saveCustomThemes,
  }
}

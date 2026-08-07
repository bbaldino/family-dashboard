import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAllConfig, CONFIG_QUERY_KEY } from '@/platform'
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
 * The two writers still `PUT` directly — moving them onto a shared save
 * mutation is separate work — but they seed the shared cache first so the
 * picker reflects the change immediately rather than looking dead until the
 * next poll. If the `PUT` fails, the poll puts the stored value back.
 */
export function useTheme() {
  const queryClient = useQueryClient()
  const { data } = useAllConfig()

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
      await fetch(`/api/config/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      })
    },
    [queryClient],
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

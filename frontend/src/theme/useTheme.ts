import { useState, useEffect, useCallback } from 'react'
import { BUILTIN_THEMES, EARTH_TONES, themeToVariables } from './types'
import type { Theme, ThemeColors } from './types'

function applyThemeToDocument(colors: ThemeColors) {
  const vars = themeToVariables(colors)
  for (const [key, value] of Object.entries(vars)) {
    document.documentElement.style.setProperty(key, value)
  }
}

export function useTheme() {
  const [activeId, setActiveId] = useState<string>('earth-tones')
  const [customThemes, setCustomThemes] = useState<Theme[]>([])
  const [loaded, setLoaded] = useState(false)

  const allThemes = [...BUILTIN_THEMES, ...customThemes]
  const activeTheme = allThemes.find((t) => t.id === activeId) ?? EARTH_TONES

  // Load from config on mount
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((config: Record<string, string>) => {
        if (config['theme.active']) {
          setActiveId(config['theme.active'])
        }
        if (config['theme.custom_themes']) {
          try {
            setCustomThemes(JSON.parse(config['theme.custom_themes']))
          } catch {
            // Invalid JSON, ignore
          }
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  // Apply active theme whenever it changes
  useEffect(() => {
    if (loaded) {
      applyThemeToDocument(activeTheme.colors)
    }
  }, [activeTheme, loaded])

  const setActiveTheme = useCallback(
    async (themeId: string) => {
      setActiveId(themeId)
      await fetch('/api/config/theme.active', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: themeId }),
      })
    },
    [],
  )

  const saveCustomThemes = useCallback(
    async (themes: Theme[]) => {
      setCustomThemes(themes)
      await fetch('/api/config/theme.custom_themes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(themes) }),
      })
    },
    [],
  )

  const applyPreview = useCallback((colors: ThemeColors) => {
    applyThemeToDocument(colors)
  }, [])

  const clearPreview = useCallback(() => {
    applyThemeToDocument(activeTheme.colors)
  }, [activeTheme])

  return {
    activeTheme,
    allThemes,
    customThemes,
    loaded,
    setActiveTheme,
    saveCustomThemes,
    applyPreview,
    clearPreview,
  }
}

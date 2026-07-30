import type { ThemeModule } from './types'

const themes = new Map<string, ThemeModule>()

export function registerTheme(theme: ThemeModule): void {
  if (themes.has(theme.id)) {
    throw new Error(`Theme with id "${theme.id}" is already registered`)
  }
  themes.set(theme.id, theme)
}

export function getTheme(id: string): ThemeModule | null {
  return themes.get(id) ?? null
}

export function getAllThemes(): ThemeModule[] {
  return Array.from(themes.values())
}

/** Test-only: reset the registry between tests. Not exported from the barrel. */
export function _resetRegistry(): void {
  themes.clear()
}

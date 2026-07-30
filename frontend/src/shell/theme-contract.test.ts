import { describe, expect, it } from 'vitest'
import { getAllThemes } from './ThemeRegistry'
import type { ScreenKey } from './types'

// Importing a theme file registers it as a side effect.
// Every theme this project ships must be imported here so the contract test covers it.
import '@/themes/grid'

const REQUIRED_SCREENS: ScreenKey[] = [
  'home',
  'calendar',
  'media',
  'cameras',
  'health',
]

describe('theme contract', () => {
  it('at least one theme is registered', () => {
    expect(getAllThemes().length).toBeGreaterThan(0)
  })

  it.each(getAllThemes().map((t) => [t.id, t]))(
    'theme "%s" provides every required screen',
    (_id, theme) => {
      for (const key of REQUIRED_SCREENS) {
        expect(theme.screens[key], `theme ${theme.id} is missing screen ${key}`).toBeDefined()
      }
    },
  )

  it('every registered theme id is unique', () => {
    const ids = getAllThemes().map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every canvas is well-formed', () => {
    for (const theme of getAllThemes()) {
      if (theme.canvas.model === 'fluid') continue
      expect(theme.canvas.designWidth).toBeGreaterThan(0)
      expect(theme.canvas.designHeight).toBeGreaterThan(0)
      expect(theme.canvas.minViewportWidth).toBeGreaterThan(0)
    }
  })
})

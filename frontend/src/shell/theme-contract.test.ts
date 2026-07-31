import { describe, expect, it } from 'vitest'
import { getAllThemes } from './ThemeRegistry'
import type { ScreenKey } from './types'

// Importing a theme file registers it as a side effect.
// Every theme this project ships must be imported here so the contract test covers it.
import '@/themes/grid'
import '@/themes/broadsheet'

// Every theme must provide Home — it's the screen the shell routes to by
// default and the one ScreenNotAvailable links back to. Beyond that a theme
// may ship screens incrementally; the shell renders ScreenNotAvailable for
// anything it omits.
const MINIMUM_SCREENS: ScreenKey[] = ['home']

// Grid is the fallback theme, so it alone must be complete.
const COMPLETE_THEME_ID = 'grid'
const ALL_SCREENS: ScreenKey[] = [
  'home',
  'calendar',
  'media',
  'media.artist',
  'media.album',
  'cameras',
  'health',
]

describe('theme contract', () => {
  it('at least one theme is registered', () => {
    expect(getAllThemes().length).toBeGreaterThan(0)
  })

  it.each(getAllThemes().map((t) => [t.id, t]))(
    'theme "%s" provides the minimum screens',
    (_id, theme) => {
      for (const key of MINIMUM_SCREENS) {
        expect(theme.screens[key], `theme ${theme.id} is missing screen ${key}`).toBeDefined()
      }
    },
  )

  it(`the fallback theme "${COMPLETE_THEME_ID}" provides every screen`, () => {
    const grid = getAllThemes().find((t) => t.id === COMPLETE_THEME_ID)
    expect(grid, `${COMPLETE_THEME_ID} theme is not registered`).toBeDefined()
    for (const key of ALL_SCREENS) {
      expect(grid!.screens[key], `${COMPLETE_THEME_ID} is missing screen ${key}`).toBeDefined()
    }
  })

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

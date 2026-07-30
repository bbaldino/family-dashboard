import { describe, expect, it } from 'vitest'
import { ROUTE_PATHS } from './routes'
import type { ScreenKey } from './types'

const ALL_SCREEN_KEYS: ScreenKey[] = [
  'home',
  'calendar',
  'media',
  'media.artist',
  'media.album',
  'cameras',
  'health',
]

describe('ROUTE_PATHS', () => {
  it('has an entry for every ScreenKey', () => {
    for (const key of ALL_SCREEN_KEYS) {
      expect(ROUTE_PATHS[key]).toBeDefined()
      // 'home' is the index route (empty string); everything else starts with a letter
      if (key !== 'home') expect(ROUTE_PATHS[key]).toMatch(/^[a-z]/)
    }
  })

  it('home is the index route (empty string)', () => {
    expect(ROUTE_PATHS.home).toBe('')
  })

  it('URL paths are unique', () => {
    const values = Object.values(ROUTE_PATHS)
    expect(new Set(values).size).toBe(values.length)
  })

  it('parameterized routes use react-router :param syntax', () => {
    expect(ROUTE_PATHS['media.artist']).toBe('media/artist/:uri')
    expect(ROUTE_PATHS['media.album']).toBe('media/album/:uri')
  })
})

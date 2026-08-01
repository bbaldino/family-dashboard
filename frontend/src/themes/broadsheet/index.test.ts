import { describe, expect, it } from 'vitest'
import { broadsheetTheme } from './index'

describe('broadsheetTheme', () => {
  it('is a fixed-scale 1600x900 canvas with an 800px floor', () => {
    expect(broadsheetTheme.canvas).toEqual({
      model: 'fixed-scale',
      designWidth: 1600,
      designHeight: 900,
      minViewportWidth: 800,
    })
  })

  it('ships Home, the Datebook (calendar), and Media (The Listening Room) in this phase', () => {
    expect(Object.keys(broadsheetTheme.screens)).toEqual(['home', 'calendar', 'media'])
  })
})

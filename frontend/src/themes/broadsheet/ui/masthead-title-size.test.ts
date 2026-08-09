import { describe, expect, it } from 'vitest'
import { mastheadTitleSize } from './masthead-title-size'

/** The Centre Spread's centre title, whose mock names 62px specifically. */
const SPREAD = 62
/** The Media screen's centre title — the shared 72px numeral. */
const MEDIA = 72

describe('mastheadTitleSize', () => {
  it('leaves a short title at its design size', () => {
    expect(mastheadTitleSize('Amber Hours', SPREAD)).toBe(SPREAD)
  })

  it('never exceeds the design size, however short the title', () => {
    expect(mastheadTitleSize('Go', SPREAD)).toBe(SPREAD)
    expect(mastheadTitleSize('', SPREAD)).toBe(SPREAD)
  })

  it('steps down as the title lengthens', () => {
    // One string per rung, each landing in a *different* step. Getting this
    // fixture wrong has bitten twice: first a 33-character "medium" sharing
    // a bucket with a 41-character "long", then a 42-character "long" that
    // missed its rung by 2px and floored, landing level with the 62-character
    // one. Both times the test was wrong and the ramp was right — a floor
    // means everything past it *is* the same size.
    const short = mastheadTitleSize('Amber Hours', SPREAD) // 11
    const medium = mastheadTitleSize('Late Night Drive in the Rain', SPREAD) // 28
    const long = mastheadTitleSize('Late Night Drive in Winter Rain and Snow', SPREAD) // 40
    const absurd = mastheadTitleSize(
      'Everything In Its Right Place (Remastered 2016 Deluxe Edition)', // 62, floors
      SPREAD,
    )
    expect(short).toBeGreaterThan(medium)
    expect(medium).toBeGreaterThan(long)
    expect(long).toBeGreaterThan(absurd)
  })

  /**
   * The bug this function was rewritten for. "the Kitchen and Bedroom" is 23
   * characters — short enough that a length-only ramp left it at full size,
   * where it wrapped to a second line and added 79px to the Media masthead.
   * The same string fits on one line at the Centre Spread's smaller base, so
   * only a width-aware rule gets both right.
   */
  it('accounts for the base size, not just the length', () => {
    const label = 'the Kitchen and Bedroom'
    expect(mastheadTitleSize(label, SPREAD)).toBe(SPREAD)
    expect(mastheadTitleSize(label, MEDIA)).toBeLessThan(MEDIA)
  })

  it('keeps the chosen size within the cell it was given', () => {
    const width = 675
    for (const text of [
      'Go',
      'Amber Hours',
      'the Kitchen and Bedroom',
      'the Kitchen, Deck, Patio and Office',
      'Late Night Drive in Winter Rain and Snow',
    ]) {
      const size = mastheadTitleSize(text, MEDIA, width)
      // 0.42 is the module's own advance estimate; anything it returns above
      // the floor must fit by that same measure, or it will wrap.
      const estimated = text.length * size * 0.42
      expect(estimated).toBeLessThanOrEqual(width)
    }
  })

  it('floors rather than shrinking without limit', () => {
    const long = mastheadTitleSize('x'.repeat(60), SPREAD)
    const absurd = mastheadTitleSize('x'.repeat(400), SPREAD)
    expect(long).toBe(absurd)
    // Still legible as a headline — past here the backstop is the element's
    // own `truncate`, not an unreadable size.
    expect(absurd).toBeGreaterThanOrEqual(Math.round(SPREAD * 0.5))
  })

  it('honours a narrower cell when one is given', () => {
    const text = 'Amber Hours'
    expect(mastheadTitleSize(text, SPREAD, 675)).toBeGreaterThan(
      mastheadTitleSize(text, SPREAD, 200),
    )
  })

  it('ignores surrounding whitespace when measuring', () => {
    expect(mastheadTitleSize('   Amber Hours   ', SPREAD)).toBe(
      mastheadTitleSize('Amber Hours', SPREAD),
    )
  })
})

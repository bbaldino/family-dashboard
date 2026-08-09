import { describe, expect, it } from 'vitest'
import { mastheadTitleSize } from './masthead-title-size'

/**
 * The Centre Spread's centre title is 62px by design (its mock names that
 * value specifically), so it is the base used throughout here.
 */
const BASE = 62

describe('mastheadTitleSize', () => {
  it('leaves a short title at its design size', () => {
    expect(mastheadTitleSize('Amber Hours', BASE)).toBe(BASE)
  })

  it('never exceeds the design size, however short the title', () => {
    expect(mastheadTitleSize('Go', BASE)).toBe(BASE)
    expect(mastheadTitleSize('', BASE)).toBe(BASE)
  })

  it('steps down as the title lengthens', () => {
    // One string per step, and they must land in *different* steps — the
    // first draft of this test used a 33-character "medium" that fell into
    // the same bucket as the 41-character "long", so two rungs of the ramp
    // returned the same size and the assertion compared 40 with 40.
    const short = mastheadTitleSize('Amber Hours', BASE) // 11
    const medium = mastheadTitleSize('Late Night Drive in Winter', BASE) // 26
    const long = mastheadTitleSize('Everything In Its Right Place (Remastered)', BASE) // 41
    const absurd = mastheadTitleSize(
      'Everything In Its Right Place (Remastered 2016 Deluxe Edition)',
      BASE,
    )
    // Strictly decreasing — the point of the ramp. Asserting the ordering
    // rather than four literals keeps this from re-baselining every time a
    // threshold is retuned, while still failing if a step is flattened.
    expect(short).toBeGreaterThan(medium)
    expect(medium).toBeGreaterThan(long)
    expect(long).toBeGreaterThan(absurd)
  })

  it('floors rather than shrinking without limit', () => {
    const long = mastheadTitleSize('x'.repeat(60), BASE)
    const absurd = mastheadTitleSize('x'.repeat(400), BASE)
    expect(long).toBe(absurd)
    // Still legible as a headline — the backstop for anything past here is
    // the element's own `truncate`, not an unreadable size.
    expect(absurd).toBeGreaterThanOrEqual(Math.round(BASE * 0.5))
  })

  it('scales relative to whatever base it is given', () => {
    // The Media screen's centre title is the shared 72px numeral, not 62.
    const at62 = mastheadTitleSize('Harbor Lights on a Winter Evening', 62)
    const at72 = mastheadTitleSize('Harbor Lights on a Winter Evening', 72)
    expect(at72).toBeGreaterThan(at62)
  })

  it('ignores surrounding whitespace when measuring', () => {
    expect(mastheadTitleSize('   Amber Hours   ', BASE)).toBe(
      mastheadTitleSize('Amber Hours', BASE),
    )
  })
})

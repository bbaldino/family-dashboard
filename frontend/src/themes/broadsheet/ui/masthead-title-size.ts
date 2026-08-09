/**
 * How large a masthead's centre title can be set before it stops fitting.
 *
 * A masthead title is whatever the data hands it — a track name, a room
 * label — and those vary from "Low Tide" to "Everything In Its Right Place
 * (Remastered 2016 Deluxe Edition)". At one fixed size the long ones either
 * wrap to a second line, which is what makes the masthead tall, or truncate
 * to an ellipsis and a few words, which reads as broken.
 *
 * So the size steps down as the text gets longer, the way a sub-editor sets
 * a longer headline smaller rather than cutting it.
 *
 * **Width, not character count.** An earlier version keyed the steps off
 * length alone, which is wrong as soon as two callers use different base
 * sizes: the same 23-character room label fits on one line at the Centre
 * Spread's 62px and wraps to two at the Media screen's 72px. That wrap was
 * worth 79px of masthead height. What matters is the text's *rendered
 * width* against the cell, so that is what this estimates.
 *
 * **Steps, not a continuous fit.** A continuous size would jitter by a pixel
 * or two between adjacent tracks and never settle, and it invites measuring
 * the DOM. Fixed steps give the same title the same size every time and are
 * testable without a browser.
 */

/**
 * Average glyph advance as a fraction of font size, for the display serif in
 * italic. Measured, not guessed: a 62-character title at 62px reported a
 * `scrollWidth` of 1474px — 1474 / (62 × 62) ≈ 0.383. Rounded up to 0.42 so
 * the estimate errs towards setting text slightly smaller than it strictly
 * needs to be, since being one step small is invisible and being one step
 * large costs a wrapped line.
 */
const AVG_ADVANCE = 0.42

/**
 * The centre cell's width in the shared `MastheadFrame` — the `1.5fr` of a
 * `0.85fr 1.5fr 0.85fr` grid across the broadsheet's 1600px canvas, less its
 * 56px side padding and two 24px gaps. Measured at 675px.
 *
 * A default rather than something every caller passes: every masthead in the
 * theme uses the same frame, so the one that ever differs should be the one
 * that has to say so.
 */
const CENTRE_CELL_WIDTH = 675

/**
 * Scales tried in order, largest first. The last is the floor: past it, the
 * element's own `truncate` takes over rather than shrinking to unreadable.
 *
 * Five rungs rather than four because four were too coarse to be useful at
 * the top of the range: a 41-character title at 62px missed the third rung
 * by 3% and fell all the way to the floor, landing at the same size as a
 * 62-character one. The estimate below is not accurate to 3%, so the steps
 * have to be closer together than its error.
 */
const SCALES: readonly number[] = [1, 0.85, 0.72, 0.62, 0.55]

/**
 * The font size for `text` in a masthead centre cell whose design size is
 * `baseSize` — the size a short title is set at, and never exceeded.
 *
 * Returns the largest scale of `baseSize` whose estimated rendered width
 * fits `availableWidth`, or `baseSize × 0.55` when even that does not.
 */
export function mastheadTitleSize(
  text: string,
  baseSize: number,
  availableWidth: number = CENTRE_CELL_WIDTH,
): number {
  const length = text.trim().length
  if (length === 0) return baseSize

  for (const scale of SCALES) {
    const size = baseSize * scale
    if (length * size * AVG_ADVANCE <= availableWidth) return Math.round(size)
  }
  return Math.round(baseSize * SCALES[SCALES.length - 1])
}

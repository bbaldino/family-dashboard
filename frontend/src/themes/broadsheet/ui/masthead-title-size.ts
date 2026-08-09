/**
 * How large a masthead's centre title can be set before it stops fitting.
 *
 * A masthead title is whatever the data hands it — a track name, a room
 * label — and those vary from "Low Tide" to "Everything In Its Right Place
 * (Remastered 2016 Deluxe Edition)". At one fixed size the long ones
 * truncate to an ellipsis and a few words, which reads as broken rather
 * than as a headline.
 *
 * So the size steps down as the text gets longer, the way a sub-editor sets
 * a longer headline smaller rather than cutting it. `truncate` stays on the
 * element as the backstop for the genuinely absurd; this just means it is
 * reached far less often.
 *
 * **Steps, not a formula.** A continuous size would jitter by a pixel or
 * two between adjacent tracks and never settle, and it invites measuring
 * the DOM. Fixed steps give the same title the same size every time and are
 * testable without a browser.
 *
 * The thresholds are calibrated against the Centre Spread's centre cell —
 * 675px wide at the frame's `1.5fr`, in the display serif, where the
 * average italic advance is close to 0.47em. Each step is the character
 * count at which the previous size stops fitting that width.
 */
const STEPS: ReadonlyArray<{ maxChars: number; scale: number }> = [
  { maxChars: 24, scale: 1 },
  { maxChars: 32, scale: 0.8 },
  { maxChars: 42, scale: 0.65 },
]

/** The smallest a title is ever set, as a fraction of its base size. Below
 *  this it stops reading as a masthead title at all, so anything longer
 *  truncates instead of shrinking further. */
const FLOOR_SCALE = 0.55

/**
 * The font size for `text` in a masthead centre cell whose design size is
 * `baseSize` — the size a short title is set at, and never exceeded.
 *
 * Returns `baseSize` for anything short enough to fit, stepping down to
 * `baseSize * 0.55` for the longest.
 */
export function mastheadTitleSize(text: string, baseSize: number): number {
  const length = text.trim().length
  const step = STEPS.find((s) => length <= s.maxChars)
  return Math.round(baseSize * (step ? step.scale : FLOOR_SCALE))
}

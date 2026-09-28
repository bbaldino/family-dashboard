/**
 * Colour and capacity tokens for the Sports section.
 *
 * The mock (`public/mock5/sports.jsx`) hardcodes a palette (`SP.*`); these map
 * it onto the broadsheet's own CSS custom properties, with `color-mix`
 * approximations for the handful the theme has no token for — the same
 * approach `datebook/colors.ts` documents. `SP.sub` (#6a5d4d) is close enough
 * to `--ink-muted` (#6b6259) to use it directly.
 */

/** Cell/table hairline (mock `SP.rule`, #c8bca6 — a soft warm tan, not full
 *  ink). Same formula the datebook's `CELL_RULE` uses. */
export const SP_RULE = 'color-mix(in srgb, var(--rule) 25%, var(--paper))'

/** The deeper body ink for table figures and deks (mock `SP.ink2`, #2e2620). */
export const SP_INK2 = 'color-mix(in srgb, var(--paper) 12%, var(--ink) 88%)'

/** The followed team's own table row — a barely-there rust wash (mock
 *  `rgba(180,58,26,0.05)`). */
export const SP_ME_ROW = 'color-mix(in srgb, var(--rust) 5%, transparent)'

/**
 * Row caps per column shape — how many rows each block seats before rolling
 * the rest into a "+N more" line. **Sized for the worst case, not today's
 * copy**: In brief headlines and deks, and finished-round summaries, clamp to
 * two lines (`clampLines`), so every row has a known maximum height and a cap
 * that fits that maximum fits any text. Measured at 1920×1080 (the 1600×900
 * canvas) with every visible headline and dek at its two-line maximum, the
 * division table in full (it is never truncated — spec + Global Constraints)
 * and the other blocks at their caps.
 *
 * Metric: each column section's `scrollHeight - clientHeight` (a gap-to-footer
 * reading hides clipped content), plus the column's own slack — the room left
 * below In brief — since the section's 14px bottom padding lets content sink
 * that far before `scrollHeight` notices. At these values every column reads 0
 * with slack ≥ 0 in the four scenarios, live, and each worst case below.
 *
 * - `regular` is bound by MLB (5-row division, the tallest a followed league
 *   has): 7px worst-case slack. A 4th score clips it by 6px; a 3rd brief item
 *   by 38px. Scores outrank the brief (the spec sheds In brief first), and a
 *   3rd item would need scores cut to 1. An 8-team division (NHL) doesn't fit
 *   at any sensible caps — 75px over at these.
 * - `briefDeks` is 1 (the spec allows 1–2): a 2nd dek clips worst-case MLB by
 *   18px and live NBA's narrow column by 4px.
 * - `postseason.brief` is bound by an eight-series first round (NBA/NHL) with
 *   its play-in done and three rounds to come: 18px slack. A 2nd item clips it
 *   by 27px. MLB's own postseason (≤4 series) has 110–150px to spare.
 * - `postseason.series` is 8 — the most concurrent series any supported
 *   league's first round has, so it never actually trims.
 * - `compact.brief` is bound by live NBA (narrow 0.62fr column): 20px slack
 *   (its headlines already run to two lines). A 10th item clips it by 25px.
 */
export const COLUMN_CAPS = {
  regular: { scores: 3, brief: 2 },
  postseason: { series: 8, brief: 1 },
  compact: { brief: 9 },
  briefDeks: 1,
}

/** Clamp a free-text block to `lines` whole lines with an ellipsis — how the
 *  section bounds text it doesn't control (ESPN headlines, deks, round
 *  summaries), so the fixed `COLUMN_CAPS` hold whatever the copy's length.
 *  `LiveGame`'s scoring recap spells out the same four properties inline. */
export const clampLines = (lines: number) => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical' as const,
  overflow: 'hidden',
})

/** The small uppercase sub-label style shared by `LeagueScores`'s "Around the
 *  <league>" header and `PostseasonSeries`'s round/status labels. */
export const SP_SUB_LABEL = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  letterSpacing: '0.16em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-muted)',
}

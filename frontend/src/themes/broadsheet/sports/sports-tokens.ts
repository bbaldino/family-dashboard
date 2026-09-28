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
 * Row caps per column shape. Scores and series are fixed caps; `brief` is a
 * **maximum** — `LeagueColumn` fits In brief to the room actually left under
 * the card, the (never-truncated, agate-height) division table and the
 * scores, showing as many whole items as fit up to this cap and naming the
 * rest in "+N more". Headlines and deks clamp to two lines (`clampLines`),
 * so no item is taller than its clamp and no copy can clip a column.
 *
 * Measured at 1920×1080 (the 1600×900 canvas): each column's In brief ends
 * inside the room it was given — slack ≥ 0, nothing clipped — in the four
 * scenarios, live, and a worst case with every headline and dek at its
 * two-line maximum, including an eight-team (NHL-sized) division and an
 * eight-series first round.
 *
 * - `regular.scores` is 4: with agate table rows (5 rows 126px, 8 rows 192px,
 *   down from ~38px a row) it leaves live MLB 3 brief items and NFL 4.
 * - `briefDeks` is 1 (the spec allows 1–2): a second dek costs a whole
 *   headline — live MLB shows 2 items with it, 3 without.
 * - `regular.brief` 6, `postseason.brief` 4 and `compact.brief` 9 are the
 *   most a column shows even with room to spare: a column is a front page,
 *   not the whole wire.
 * - `postseason.series` is 8 — the most concurrent series any supported
 *   league's first round has, so it never actually trims.
 */
export const COLUMN_CAPS = {
  regular: { scores: 4, brief: 6 },
  postseason: { series: 8, brief: 4 },
  compact: { brief: 9 },
  briefDeks: 1,
}

/** Clamp a free-text block to `lines` whole lines with an ellipsis — how the
 *  section bounds text it doesn't control (ESPN headlines, deks, round
 *  summaries), so every row has a known maximum height whatever the copy.
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

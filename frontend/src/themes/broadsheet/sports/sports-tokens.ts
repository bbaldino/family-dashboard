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

/** A hair darker than the page, for the wire-plate placeholder ground (mock
 *  `SP.paperDeep`). */
export const SP_PAPER_DEEP = 'color-mix(in srgb, var(--ink) 8%, var(--paper))'

/** The deeper body ink for table figures and deks (mock `SP.ink2`, #2e2620). */
export const SP_INK2 = 'color-mix(in srgb, var(--paper) 12%, var(--ink) 88%)'

/** The secondary accent — league labels and stat abbreviations (mock
 *  `SP.accent2`, a muted gold). No broadsheet token leans warm-yellow, so this
 *  reuses the datebook's `ACCENT2` muted-rust formula for the same
 *  "secondary accent, distinct from the vivid primary" role. */
export const SP_ACCENT2 = 'color-mix(in srgb, var(--rust) 55%, var(--ink-muted) 45%)'

/** The followed team's own table row — a barely-there rust wash (mock
 *  `rgba(180,58,26,0.05)`). */
export const SP_ME_ROW = 'color-mix(in srgb, var(--rust) 5%, transparent)'

/**
 * How many rows each column seats before rolling the rest into a "+N more"
 * line. **Measured against our own rendering, not adopted from the mock.**
 *
 * The mock's caps are higher (scores 12, tableRows 10, leaderCats 5), but our
 * Newsreader Variable renders a hair taller than the mock's Google-Fonts
 * Newsreader — its rows don't fit our column box even though that box is a few
 * pixels taller than the mock's. Verified against `scrollHeight - clientHeight`
 * at 1600×900, the metric the changelog is explicit is the right one (a
 * gap-to-footer reading filters out clipped content by construction): at these
 * values every column reads zero, and one row more clips col 2 by 24px, col 3
 * by 3px, or col 4 by 16px.
 *
 * `split` seats far fewer per track — two tracks share each column, and column
 * 2 is the tightest of all, carrying two tables plus Form plus Elsewhere. Its
 * tables run three rows apiece (top of each division, which is the point of a
 * pennant-race split); four clips it by 32px. Leaders are `[primary, secondary]`
 * — the second front gets one category, the first two. Every split value was
 * measured the same way as the single-front ones.
 */
export const CAPS = {
  single: { scores: 10, tableRows: 8, leaderCats: 4 },
  split: { scores: 4, tableRows: 3, leaderCats: [2, 1] as const },
}

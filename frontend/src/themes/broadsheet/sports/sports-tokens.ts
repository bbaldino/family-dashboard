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
 * the rest into a "+N more" line. **Measured at 1920×1080 (the 1600×900
 * canvas) against real ESPN data, not just the fixtures**: real deks run to
 * three lines and real headlines to two, where the fixtures' are one of each.
 * The division table has no cap: it is never truncated (spec + Global
 * Constraints), so it is the fixed cost everything else is sized around.
 *
 * Metric: each column section's `scrollHeight - clientHeight` (a gap-to-footer
 * reading hides clipped content), plus the column's own slack — the room left
 * below In brief — since the section's 14px bottom padding lets content sink
 * that far before `scrollHeight` notices. At these values every column reads 0
 * in all four scenarios and live, and the slack stays ≥ 0 except a synthetic
 * worst case (live MLB with its longest dek promoted to the top: -4px, inside
 * the padding, nothing clipped).
 *
 * - `regular` is bound by live MLB (5-row NL West table): 16px slack. One more
 *   score clips it by 17px (longest dek first); one more brief item by 29px.
 * - `briefDeks` is 1 (the spec allows 1–2): a second real dek clips live MLB
 *   by 27px — it costs more than a whole score row.
 * - `postseason.brief` is bound by an eight-series first round (NBA/NHL) with
 *   real MLB news: 3px slack. A fourth item clips it by 25px.
 * - `postseason.series` is 8 — the most concurrent series any supported
 *   league's first round has, so it never actually trims.
 * - `compact.brief` is bound by live NBA (narrow 0.62fr column): 22px slack
 *   with its longest dek first. A ninth item clips it by 22px.
 */
export const COLUMN_CAPS = {
  regular: { scores: 4, brief: 2 },
  postseason: { series: 8, brief: 3 },
  compact: { brief: 8 },
  briefDeks: 1,
}

/** The small uppercase sub-label style shared by `LeagueScores`'s "Around the
 *  <league>" header and `PostseasonSeries`'s round/status labels. */
export const SP_SUB_LABEL = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  letterSpacing: '0.16em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-muted)',
}

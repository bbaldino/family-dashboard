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
 * Row caps per column shape — starting values, replaced by measurement in the
 * by-sport rework's capacity step (see the doc comment written there). The
 * division table has no cap: it is never truncated (spec + Global
 * Constraints).
 */
export const COLUMN_CAPS = {
  regular: { scores: 6, brief: 4 },
  postseason: { series: 8, brief: 5 },
  compact: { brief: 8 },
  briefDeks: 2,
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

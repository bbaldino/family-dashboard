/**
 * The design mock (`docs/superpowers/designs/broadsheet/media.jsx`) defines
 * a handful of colours with no equivalent broadsheet CSS custom property —
 * `paperDeep`, `ruleSoft`, `ink2`, `accent2`. Per the design brief, these
 * are approximated from the palette that already exists (`--paper`,
 * `--ink`, `--rule`) via `color-mix`, the same way `datebook/colors.ts`'s
 * `CELL_RULE` and `ScheduleColumn`'s `RULE_SOFT` already do, rather than
 * adding new tokens to `broadsheet.css`.
 *
 * `accent2` (`#8a6321`) is declared in the mock's palette object but never
 * referenced by its render — dead in the mock itself, the same way
 * `paperDeep` was dead in the calendar mock (see `datebook/colors.ts`'s own
 * note) — so nothing here approximates it.
 */

/** Shelf/search/for-you card background (mock `C.paperDeep`, #efe7d2 — a
 *  shade deeper than the page's own paper). Unlike the calendar mock, this
 *  one's `paperDeep` is actually drawn (`media.jsx:137,157`), so it earns an
 *  approximation here. */
export const CARD_BG = 'color-mix(in srgb, var(--ink) 8%, var(--paper) 92%)'

/** Card border (mock `C.ruleSoft`, #e1d4b6 — lighter than `datebook/colors.ts`'s
 *  `CELL_RULE`, which approximates the mock's plain `C.rule`, #c8bca6). A
 *  dense repeating grid of cards reads heavier than the theme's occasional
 *  full-ink hairline (see `CELL_RULE`'s own reasoning), so this gets its
 *  own, even softer mix rather than `var(--rule)` directly. */
export const CARD_RULE = 'color-mix(in srgb, var(--rule) 15%, var(--paper))'

/** The masthead's small screen title and the transport rail's prev/next
 *  glyphs (mock `C.ink2`, #2e2620 — a touch warmer and lighter than the
 *  theme's full `--ink`, #191512, used everywhere else in the theme). */
export const INK2 = 'color-mix(in srgb, var(--paper) 12%, var(--ink) 88%)'

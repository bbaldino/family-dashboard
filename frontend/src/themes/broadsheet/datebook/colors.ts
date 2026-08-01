/**
 * The design mock (`docs/superpowers/designs/broadsheet/calendar.jsx`)
 * defines a handful of colours with no equivalent broadsheet CSS custom
 * property — `paperDeep`, `ruleSoft`, `forestSoft`, `creamSoft`, `accent2`,
 * `ink2`. Per the design brief, these are approximated from the palette
 * that already exists (`--paper`, `--ink`, `--rust`, `--forest`,
 * `--ink-muted`) via `color-mix`, the same way `ScheduleColumn`'s
 * `RULE_SOFT` and `HouseholdColumn`'s `SOFT_ACCENT` already do, rather than
 * adding new tokens to `broadsheet.css`.
 *
 * `paperDeep` (#efe7d2) is declared in the mock's palette object but never
 * actually referenced by its render — dead in the mock itself — so nothing
 * here approximates it.
 */

/** The grid's cell/header rules (mock `C.rule`, #c8bca6 — a soft warm tan).
 *  Broadsheet's own `--rule` token is full ink (#191512), reserved for
 *  structural dividers (the masthead's double rule, the weekday header's
 *  solid rule); using it for every cell border in a 6x7 grid would read as
 *  much heavier than the mock's hairlines. Same formula as
 *  `ScheduleColumn`'s `RULE_SOFT`. */
export const CELL_RULE = 'color-mix(in srgb, var(--rule) 25%, var(--paper))'

/** Today's cell background (mock #fff7e8 — barely lighter and warmer than
 *  the page's own paper). */
export const TODAY_BG = 'color-mix(in srgb, var(--paper) 80%, white 20%)'

/** All-day (and birthday) pill background (mock `C.forestSoft`, #cad9c1). */
export const FOREST_SOFT = 'color-mix(in srgb, var(--forest) 20%, var(--paper) 80%)'

/** Timed-event pill background (mock `C.creamSoft`, #f3e6c4 — a deeper,
 *  warmer cream than the page). */
export const CREAM_SOFT = 'color-mix(in srgb, var(--rust) 12%, var(--paper) 88%)'

/** Timed-event pill accent — time label and left border (mock `C.accent2`,
 *  #8a6321, a muted gold distinct from the kicker/today rust). None of
 *  broadsheet's tokens lean warm-yellow, so an exact hue isn't reachable by
 *  mixing them; this reuses `HouseholdColumn`'s `SOFT_ACCENT` formula — a
 *  muted rust — for the same "secondary accent, distinct from the vivid
 *  primary" role that formula already fills elsewhere in the theme. */
export const ACCENT2 = 'color-mix(in srgb, var(--rust) 55%, var(--ink-muted) 45%)'

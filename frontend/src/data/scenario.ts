/**
 * Puts the dashboard into a named, fixture-driven data state via a
 * `?scenario=<name>` query parameter — e.g. `?scenario=packed` — so states
 * reality rarely produces (a packed calendar, an empty one) can be designed
 * against and verified, including on the wall tablet itself.
 *
 * Read once when this module first loads: the dashboard never navigates
 * between scenarios at runtime, so there's no need to re-read on every
 * render. With no `?scenario=` parameter, `activeScenario` is `null` and
 * every hook falls through to its normal fetch — nothing about everyday
 * use changes.
 */

/** Pure parser, kept separate from the module-load read below so it can be
 *  unit-tested without touching `window.location`. */
export function parseScenario(search: string): string | null {
  return new URLSearchParams(search).get('scenario')
}

export const activeScenario: string | null =
  typeof window !== 'undefined' ? parseScenario(window.location.search) : null

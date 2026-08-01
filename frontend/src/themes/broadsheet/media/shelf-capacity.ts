/**
 * How many rows of cards each shelf-style section renders before the rest
 * are silently capped, rather than trusting however many the data source
 * happens to return (`useTopTracks` is capped at 12 server-side; `/recent`
 * and `/search` are not). Every card is a fixed-height row regardless of
 * its text — a 48px cover plus padding, never taller — so unlike a
 * wrapping text list, a card's height never depends on its content.
 *
 * The left column (`Media.tsx`) is `overflow: hidden` inside a flex row
 * that gets whatever height is left after the masthead, the search/tabs
 * row, and the footer's 64px reservation — content that runs long clips
 * rather than pushing the row below it off the canvas, the same guarantee
 * `ScheduleColumn`'s and `Home`'s own row budgets rely on.
 *
 * These numbers are not arithmetic — they were measured live, per the
 * design brief's warning that three separate overflow bugs have shipped in
 * this theme from trusting a count instead of measuring: with Newsreader
 * and Geist Mono actually loaded (`?scenario=packed`, then padded to more
 * cards than the fixture has via DOM injection to force each shelf to its
 * cap), a real card renders at ~68px, a shelf's own kicker at ~15px, and
 * the two-shelf "Quick Dials" body has ~617px of content height to work
 * with. Three rows a side (`FREQUENTLY_PLAYED_MAX_ROWS` +
 * `RECENTLY_PLAYED_MAX_ROWS` = 6 rows total, matching `useTopTracks`'s own
 * 12-item cap) measured with the shelves column comfortably under its
 * `clientHeight` (no overflow); four rows a side (8 total) measured
 * clipped. Six rows is the number that actually fits, with real margin
 * to spare against font-metric drift — not eight, and not the much smaller
 * three total the mock itself shows (a hard-coded 3-row/1-row split that
 * undersells how much room this canvas actually has).
 */
export const FREQUENTLY_PLAYED_MAX_ROWS = 3
export const RECENTLY_PLAYED_MAX_ROWS = 3
export const FOR_YOU_MAX_ROWS = 2
export const SEARCH_RESULTS_MAX_ROWS = 3

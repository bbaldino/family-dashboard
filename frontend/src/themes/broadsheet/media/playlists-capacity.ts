/**
 * How many playlist cards the Media page's Playlists shelf renders before the
 * rest are capped.
 *
 * The shelf fills the band the two Quick Dials grids leave empty at the foot
 * of the left column — the dead-band fix the design's changelog describes.
 * Measured live at 1600×900 (`?scenario=packed`, real fonts loaded), not
 * computed: with Frequently and Recently played each showing their rows above,
 * the reclaimed band holds two rows of the 4-column grid before the column's
 * own `overflow: hidden` would clip — `scrollHeight` stayed under `clientHeight`
 * at 8 cards (two rows) and exceeded it at 12 (three rows). Eight is the number
 * that fits with margin, and it matches the mock's own eight-playlist band.
 *
 * The same measured-not-guessed discipline as `shelf-capacity.ts` and
 * `profile-capacity.ts` — this theme has shipped overflow bugs from trusting a
 * count over a measurement.
 */
export const MAX_PLAYLISTS = 8

/** The grid's column count, shared by the component and the row-cap maths. */
export const PLAYLISTS_COLUMNS = 4

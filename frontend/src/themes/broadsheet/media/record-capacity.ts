/**
 * How many of an album's tracks `RecordRunningOrder` renders across its two
 * columns before the rest are silently capped, with the remainder named as
 * "+N more tracks" — the same convention every other capped list in this
 * theme uses (`CentreSpreadRunningOrder`'s "+N more", `shelf-capacity.ts`'s
 * row caps). `AlbumDetail.tracks` is whatever the backend's album lookup
 * returns, with no upper bound of its own — the design brief calls out a
 * 30-track album by name as the case this must not overflow on.
 *
 * Measured live, not computed, per the design brief's warning that three
 * separate overflow bugs have already shipped in this theme from trusting a
 * count instead of measuring: at `?scenario=packed` (1600×900, real fonts
 * loaded, `window.getComputedStyle` scale factored out), with the running
 * order's own columns padded past the fixture's own 4 tracks via DOM
 * injection (the same technique `shelf-capacity.ts`'s and
 * `centre-spread-capacity.ts`'s own headers describe) — **every row given a
 * `feat.` line**, the tallest realistic row shape (~56px vs. ~38px plain),
 * so the measurement doesn't depend on how feature-heavy a given album
 * happens to be. A column has ~633px to work with (the body's measured
 * `696px` minus the section's own `20px`/`20px` padding); at that row
 * height the ceiling is 11 rows a column (22 total) before `scrollHeight`
 * exceeds `clientHeight`. This picks 9 a column (18 total) — real margin
 * against font-metric drift, the same trade `shelf-capacity.ts`'s own
 * six-of-a-possible-more choice describes. Both the fixture's 4 tracks and
 * the real "Push The Button" (11 tracks, one `feat.`) sit comfortably under
 * this.
 */
export const MAX_RECORD_TRACKS = 18

/**
 * How many rows/cards `ProfileTopTracks` and `ProfileDiscography` render
 * before the rest are silently capped, with the remainder named — the same
 * convention `record-capacity.ts` and every other capped list in this theme
 * uses. Neither `ArtistDetail.top_tracks` nor `.albums` carries a backend
 * cap of its own (unlike `useTopTracks`'s server-side 12).
 *
 * Measured live, not computed, per the design brief's warning that three
 * separate overflow bugs have already shipped in this theme from trusting a
 * count instead of measuring: at `?scenario=packed` (1600×900, real fonts
 * loaded), with both fixtures padded past their own counts via DOM
 * injection (the same technique `record-capacity.ts`'s own header
 * describes). Every top-track row is a fixed 64px regardless of content (a
 * 44px cover plus padding — unlike the running order's rows, an album line
 * never wraps to a second height the way a `feat.` line does). The
 * two-column body has ~587px to work with (the section's measured top at
 * `231px`, the canvas's `836px` footer boundary minus the section's own
 * `18px` bottom padding); the ceiling is 9 rows a column (18 total) before
 * `scrollHeight` exceeds `clientHeight`. This picks 7 a column (14 total),
 * the same margin-against-drift reasoning as `record-capacity.ts`. The
 * discography rail's 130px covers (2 columns, 14px row gap, ~169px a card)
 * fit 3 rows deep (6 covers, ~549px) with ~38px to spare before a 4th row
 * (~731px) would exceed the rail's own ~587px; this picks 6 exactly — the
 * measured ceiling itself, since there's no partial-row slack to spare the
 * way the two text-only lists have.
 */
export const MAX_TOP_TRACKS = 14
export const MAX_DISCOGRAPHY_ALBUMS = 6

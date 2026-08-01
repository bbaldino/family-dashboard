/**
 * How many upcoming rows the Centre Spread's running order renders before
 * the rest are silently capped, with the remainder named as "+N more" —
 * the same convention every other capped list in this theme uses
 * (`HouseholdColumn`'s "+N more for {person}", `ScheduleColumn`'s "+N more
 * today", `shelf-capacity.ts`'s own row caps). `useQueue` returns whatever
 * the backend's queue happens to hold, with no upper bound of its own —
 * unlike `useTopTracks`'s server-side cap of 12 — so this screen needs its
 * own limit the same way the shelf column needs `shelf-capacity.ts`.
 *
 * Measured live, not computed, per the design brief's warning that three
 * separate overflow bugs have already shipped in this theme from trusting
 * a count instead of measuring: at `?scenario=packed` (1600×900, real fonts
 * loaded), with the running-order `<ul>` padded past the fixture's own 3
 * items via DOM injection (the same technique `shelf-capacity.ts`'s own
 * header describes) — including a stand-in "+N more" line, so the
 * measurement reflects the space that line itself takes once the cap is
 * actually active — a real row renders at ~57px. Comparing the list's own
 * `scrollHeight` against its `clientHeight` at each count: 10 rows is the
 * exact ceiling (0px overflow); 11 clips by 35px. 8 is chosen rather than
 * that ceiling itself, for the same margin against font-metric drift
 * `shelf-capacity.ts`'s own six-of-a-possible-more choice describes.
 */
export const MAX_RUNNING_ORDER_ROWS = 8

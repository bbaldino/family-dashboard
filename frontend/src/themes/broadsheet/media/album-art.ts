/**
 * The Listening Room's cover-art fallback — a gradient keyed by the item's
 * name, per the design mock (`docs/superpowers/designs/broadsheet/media.jsx:32-51`).
 * This is a designed fallback, not a placeholder: Music Assistant is
 * unreachable from this machine and the music fixtures set every image to
 * `null` (see `src/integrations/music/fixtures.ts`'s header comment), so this is
 * what the screen actually shows while it's being built, and often in
 * production too — plenty of local/imported tracks carry no artwork.
 *
 * The mock itself picks a palette entry by each card's position in its
 * hard-coded list (`idx={i}`), not by name — fine for a static mock with a
 * fixed item order, but wrong for real data, where the same track can show
 * up in a shelf, a search result, and the now-spinning rail, each with a
 * different position, and where lists reorder over time (a top track's rank
 * moves, recently-played reshuffles). Keying off the name instead makes the
 * fallback an actual property of the track rather than of wherever it
 * happens to be rendered: the same track always gets the same gradient.
 */

/** The mock's twelve-entry gradient palette (`media.jsx:32-37`) — each pair
 *  is the two stops of a `linear-gradient(135deg, a, b)`. */
export const ALBUM_GRADIENT_PALETTE: readonly (readonly [string, string])[] = [
  ['#3c5a8a', '#1c2545'],
  ['#d97a47', '#a13420'],
  ['#3a5f47', '#1c3324'],
  ['#7a4b8e', '#3a1e3d'],
  ['#b88a3d', '#5a3f1b'],
  ['#1a4f5c', '#0c2530'],
  ['#a23a52', '#451522'],
  ['#5a6f3a', '#2a3520'],
  ['#3a3e6e', '#1a1d35'],
  ['#c4663a', '#6a2e15'],
  ['#2f4a6e', '#15243a'],
  ['#8a4d6e', '#3d1e30'],
]

/** Deterministic small string hash (djb2) — not cryptographic, just needs
 *  to spread names across the palette consistently. `>>> 0` forces the
 *  32-bit result unsigned before the modulo below, since `|0`'s wraparound
 *  can otherwise leave `hash` negative. */
function hashName(name: string): number {
  let hash = 5381
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 33 + name.charCodeAt(i)) | 0
  }
  return hash >>> 0
}

/** The gradient stops for `name` — same name in, same `[a, b]` out, always.
 *  Pure and total: an empty string still hashes to a valid palette index. */
export function gradientForName(name: string): readonly [string, string] {
  const index = hashName(name) % ALBUM_GRADIENT_PALETTE.length
  return ALBUM_GRADIENT_PALETTE[index]
}

/** Up to three initials from `name`'s words, uppercased — the mock's cover
 *  fallback label (`media.jsx:49-51`). */
export function initialsForName(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 3)
    .join('')
    .toUpperCase()
}

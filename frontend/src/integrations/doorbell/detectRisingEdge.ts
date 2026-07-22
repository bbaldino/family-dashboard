/**
 * Rising-edge detector for HA entity states.
 *
 * Rules:
 *   - The FIRST observed value (prev === undefined) is a baseline; never fires.
 *   - Fires only on the exact transition prev !== 'on' && current === 'on'
 *     where prev is a real, non-baseline previous value.
 *   - 'unavailable' -> 'on' does NOT fire — a reconnect edge is treated as a
 *     new baseline (the caller resets prev to undefined on disconnect).
 *
 * Cases (asserted by inline comments; add vitest later if the frontend
 * gains a test runner):
 *   (undefined, 'off') -> false   // baseline
 *   (undefined, 'on')  -> false   // baseline; do NOT phantom-fire on load
 *   ('off', 'on')      -> true
 *   ('on', 'on')       -> false
 *   ('on', 'off')      -> false
 *   ('unavailable', 'on') -> false
 */
export function detectRisingEdge(
  prev: string | undefined,
  current: string | undefined,
): boolean {
  if (prev === undefined) return false
  if (prev === 'unavailable') return false
  return prev !== 'on' && current === 'on'
}

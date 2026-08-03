import { doorbellVarsForBroadsheet } from '@/data/doorbell'

/**
 * Reads broadsheet's palette off the live document.
 *
 * The custom properties are scoped to `.broadsheet-root` (see
 * `broadsheet.css`), so they resolve to nothing on `documentElement` — and a
 * resolver that comes back empty silently yields the doorbell page's own grey
 * defaults rather than this theme's paper and ink. Querying for the class is
 * deliberate: the obvious alternative, resolving against a component's own
 * `ref`, reads `null` during the render that computes the payload, because
 * refs attach after render. That failure is invisible — the page just looks
 * unthemed — so this takes the element that is reliably already mounted.
 */
export function resolveBroadsheetDoorbellVars(): Record<string, string> {
  const el = document.querySelector('.broadsheet-root') ?? document.documentElement
  const styles = getComputedStyle(el)
  return doorbellVarsForBroadsheet((name) => styles.getPropertyValue(name))
}

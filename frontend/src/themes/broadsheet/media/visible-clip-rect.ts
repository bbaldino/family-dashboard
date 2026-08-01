/**
 * The vertical bounds an element is actually visible within, found by
 * walking up from `el` and intersecting the bounding rect of every ancestor
 * whose computed `overflow`/`overflow-y` isn't `visible` — the same
 * technique popover libraries use to find an element's real "clipping
 * boundary" rather than trusting the viewport, which is often much bigger
 * than the box that will actually crop the content.
 *
 * Built for `TrackActionsMenu.tsx`'s own flip-to-open-upward decision: a
 * shelf card's menu can be taller than the room left below it inside
 * `Media.tsx`'s shelf column (`overflow: hidden`, sized to leave exactly
 * enough room for its own capped rows — see `shelf-capacity.ts` — not for a
 * ~190px popover on top of them), even though the *page* it's on (also
 * `overflow: hidden`, `BroadsheetLayout`'s own 1600×900 canvas) has room to
 * spare. Measured live at `?scenario=packed`'s Quick Dials tab, fully
 * packed (`FREQUENTLY_PLAYED_MAX_ROWS` + `RECENTLY_PLAYED_MAX_ROWS` = 6 real
 * rows): the bottom-right card's menu, opened downward, extended roughly
 * 200px past both the shelf column's own bottom edge *and* the page's —
 * clipped invisible either way, not merely poking past one boundary a
 * caller could special-case away.
 *
 * No ancestor clips (e.g. a row rendered directly under `<body>`) → returns
 * `null`, meaning "nothing to check against, always safe to open below" —
 * distinct from an ancestor that clips but happens to have a huge rect.
 */
export function visibleClipRect(el: Element): { top: number; bottom: number } | null {
  let top = -Infinity
  let bottom = Infinity
  let clipped = false
  let node = el.parentElement

  while (node && node !== document.body) {
    // Checked two ways because no single property is reliable everywhere:
    // a real browser expands the `overflow` shorthand into `overflow-y` on
    // `getComputedStyle`, but jsdom (this file's own test environment)
    // doesn't — an element styled with only `overflow: hidden` still
    // computes `overflowY: 'visible'` there. Conversely, an unset element's
    // `overflow` shorthand computes to `''` in jsdom rather than the
    // `'visible'` a real browser reports, so `''` has to count as "not
    // clipping" too, or every ancestor would look like it clips.
    const style = getComputedStyle(node)
    const clips = (style.overflowY !== 'visible' && style.overflowY !== '') || (style.overflow !== 'visible' && style.overflow !== '')
    if (clips) {
      const rect = node.getBoundingClientRect()
      top = Math.max(top, rect.top)
      bottom = Math.min(bottom, rect.bottom)
      clipped = true
    }
    node = node.parentElement
  }

  return clipped ? { top, bottom } : null
}

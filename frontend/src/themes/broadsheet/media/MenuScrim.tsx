/**
 * The full-page dimming layer behind an open track actions menu (mock:
 * `music-pages.jsx:170`). Rendered by `Album.tsx`/`Artist.tsx` at their own
 * root — not by the row that owns the open menu — because `position:
 * absolute; inset: 0` sizes to the nearest positioned ancestor, and a row is
 * a strip a few dozen pixels tall, not the 1600×900 page (see
 * `TrackActionsMenu.tsx`'s header comment for the fuller version of this).
 *
 * Tapping the scrim closes the menu, the usual affordance for a
 * click-outside-to-dismiss overlay; it sits below the open row (whose
 * `zIndex: 30` — mock `music-pages.jsx:101` — lifts it, and the menu inside
 * it, above this layer) but above everything else on the page.
 */
export function MenuScrim({ onClose }: { onClose: () => void }) {
  return (
    <div
      data-testid="broadsheet-menu-scrim"
      className="absolute inset-0"
      style={{ background: 'rgba(25,21,18,0.14)', zIndex: 15 }}
      onClick={onClose}
    />
  )
}

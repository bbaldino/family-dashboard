import { Cover } from './Cover'

/** The Now Spinning rail's 280px cover.
 *
 * A faux LP disc used to slide out from behind the cover's right edge. With
 * the gradient placeholders it read as a flourish; over real album art it
 * covered a third of the sleeve, so it was removed — the sleeve now shows
 * uncovered. Do not reintroduce a decorative overlay on top of artwork.
 *
 * `onTap`, when given, is the Centre Spread's entry point — tapping the
 * cover opens the full-page now-playing view (`CentreSpread.tsx`). Rendered
 * as a real `<button>` wrapping the cover, matching `ShelfCard`'s own
 * reasoning for using a button over a styled `onClick` div: a touchscreen
 * kiosk (and a keyboard) both need a real activatable target, not just a
 * clickable-looking one. Omitting `onTap` (its default) keeps this
 * component usable anywhere a plain, non-interactive cover is wanted. */
export function NowSpinningCover({
  imageUrl,
  name,
  onTap,
}: {
  imageUrl: string | null
  name: string
  onTap?: () => void
}) {
  const cover = (
    <div style={{ marginTop: 4 }}>
      <Cover imageUrl={imageUrl} name={name} size={280} />
    </div>
  )

  if (!onTap) return cover

  return (
    <button
      type="button"
      onClick={onTap}
      style={{ all: 'unset', cursor: 'pointer', display: 'block' }}
      aria-label="Open now playing"
    >
      {cover}
    </button>
  )
}

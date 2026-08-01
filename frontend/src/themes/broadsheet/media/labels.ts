/** Human label for a media type, used as a card's second line when the item
 *  has no more specific text of its own — a playlist or artist search
 *  result has no "artist" the way a track or album does. Plain-word Title
 *  Case, not an acronym, so the project's acronym-capitalisation rule
 *  doesn't apply here. */
export function typeLabel(mediaType: string): string {
  return mediaType ? mediaType.charAt(0).toUpperCase() + mediaType.slice(1) : ''
}

/** Human label for `TrackInfo.source`, MA's raw provider id — e.g.
 *  `spotify--yC8brUbw` or `library`. The part after `--` is an opaque
 *  per-instance suffix, not display text, so this keeps only the provider
 *  name and capitalises it. `null`/`undefined`/empty all return `null` so
 *  the Centre Spread's Credits column can fall back to its own dash rather
 *  than this printing one itself. */
export function sourceLabel(source: string | null | undefined): string | null {
  if (!source) return null
  const provider = source.split('--')[0]
  return provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : null
}

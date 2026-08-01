/** Human label for a media type, used as a card's second line when the item
 *  has no more specific text of its own — a playlist or artist search
 *  result has no "artist" the way a track or album does. Plain-word Title
 *  Case, not an acronym, so the project's acronym-capitalisation rule
 *  doesn't apply here. */
export function typeLabel(mediaType: string): string {
  return mediaType ? mediaType.charAt(0).toUpperCase() + mediaType.slice(1) : ''
}

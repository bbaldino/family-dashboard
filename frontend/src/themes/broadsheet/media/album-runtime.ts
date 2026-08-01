/**
 * Track count and total runtime are derived, not backend fields — neither
 * `AlbumDetail` nor `ArtistDetail` carries them (design brief: "Runtime and
 * track count are derived from tracks[]"). `Album.tsx`'s credits `<dl>` and
 * `album-note.ts`'s generated sentence both need the same total, so it's
 * computed once here rather than each re-summing `tracks[]` its own way.
 */
export function sumDurationSeconds(tracks: readonly { duration: number | null }[]): number {
  return tracks.reduce((total, track) => total + (track.duration ?? 0), 0)
}

/** `56 min`, rounded to the nearest minute. */
export function formatRuntimeMinutes(totalSeconds: number): string {
  return `${Math.round(totalSeconds / 60)} min`
}

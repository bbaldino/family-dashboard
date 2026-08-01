import type { TrackArtist } from '@/data/music'

/**
 * The `feat. {name}` line under a track title, per the design brief:
 * "`feat.` is the artists beyond the first" in `ArtistTrack.artists`, MA's
 * full credit list for the track. `artists[0]` is the same artist
 * `ArtistTrack.artist`/`artist_uri` already duplicate, so this always skips
 * it. Multiple featured artists join with a comma — the mock only ever
 * shows one, but nothing in the data guarantees that.
 *
 * `null` (not `''`) when there's nothing to show, so callers can render the
 * line conditionally with `featuredArtistsLabel(track) &&` the way every
 * other optional line in this theme does, rather than testing for an empty
 * string.
 *
 * Tolerates a missing `artists` array, not just an empty one — caught live
 * against a real backend response mid-build where a stale server process
 * (predating the field's rollout) omitted `artists` entirely rather than
 * sending `[]`. The type says this can't happen; a real response proved
 * otherwise, so this treats "not an array" the same as "no featured
 * artists" rather than trusting the type over the wire.
 */
export function featuredArtistsLabel(artists: TrackArtist[] | null | undefined): string | null {
  const featured = (artists ?? []).slice(1)
  if (featured.length === 0) return null
  return featured.map((a) => a.name).join(', ')
}

import type { EnqueueMode, PlayOptions } from '@/integrations/music'
import type { ArtistTrack } from '@/integrations/music'

/**
 * `PlayOptions` for one of the four track-actions-menu play actions, built
 * from an `ArtistTrack` (the shape both `useAlbumDetail` and
 * `useArtistDetail` return for individual tracks). Shared by `Album.tsx` and
 * `Artist.tsx` — both wire the same four actions off the same track shape,
 * the same way grid's `AlbumPage`/`ArtistPage` each define an identical
 * `commonPlay` closure (read for reference only, nothing imported).
 *
 * The four actions differ only in `radio`/`enqueueMode`:
 * - Play track → `{ radio: false, enqueueMode: 'play' }`
 * - Start radio → `{ radio: true, enqueueMode: 'play' }`
 * - Play next            → `{ radio: false, enqueueMode: 'next' }`
 * - Add to queue          → `{ radio: false, enqueueMode: 'add' }`
 */
export function trackPlayOptions(
  track: Pick<ArtistTrack, 'name' | 'artist' | 'artist_uri' | 'album' | 'album_uri' | 'image_url'>,
  { radio, enqueueMode }: { radio: boolean; enqueueMode: EnqueueMode },
): PlayOptions {
  return {
    radio,
    enqueueMode,
    mediaType: 'track',
    name: track.name,
    artist: track.artist ?? undefined,
    artistUri: track.artist_uri ?? undefined,
    album: track.album ?? undefined,
    albumUri: track.album_uri ?? undefined,
    imageUrl: track.image_url ?? undefined,
  }
}

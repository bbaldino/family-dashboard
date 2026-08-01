import type { PlayOptions } from '@/data/music'

/** The subset of a playable item's fields `useMusic().play` needs — a
 *  common shape `QuickDialsShelves`, `ForYouShelf`, and `SearchResultsPanel`
 *  each map their own source type (`TopTrack`, `RecentItem`, `SearchItem`,
 *  `CuratedPlaylist`) down to before calling `play`. */
export interface PlayableItem {
  uri: string
  mediaType: string
  name: string
  artist?: string | null
  artistUri?: string | null
  album?: string | null
  albumUri?: string | null
  imageUrl?: string | null
}

/** Tap-to-play options for any item this screen can play — the same
 *  convention grid's `QuickDials`/`SearchResults` use
 *  (`src/themes/grid/screens/media`, read for reference only, nothing
 *  imported from it): a track's tap plays it and continues with a radio
 *  station seeded from it; anything else (already a whole
 *  playlist/album/artist) just plays as-is. */
export function playOptionsFor(item: PlayableItem): PlayOptions {
  return {
    radio: item.mediaType === 'track',
    enqueueMode: 'play',
    mediaType: item.mediaType,
    name: item.name,
    artist: item.artist ?? undefined,
    artistUri: item.artistUri ?? undefined,
    album: item.album ?? undefined,
    albumUri: item.albumUri ?? undefined,
    imageUrl: item.imageUrl ?? undefined,
  }
}

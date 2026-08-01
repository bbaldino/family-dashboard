import { useMusic, useTopTracks, useRecentlyPlayed } from '@/data/music'
import type { TopTrack, RecentItem } from '@/data/music'
import { ShelfSection } from './ShelfSection'
import type { ShelfCardItem } from './ShelfCard'
import { playOptionsFor } from './play'
import { typeLabel } from './labels'
import { FREQUENTLY_PLAYED_MAX_ROWS, RECENTLY_PLAYED_MAX_ROWS } from './shelf-capacity'

/** The "Quick Dials" tab content: the two shelves, mock `media.jsx:131-169`.
 *  Every hook here can boot with no data on a cold cache — both `useQuery`
 *  calls return `data: undefined` until their first fetch resolves, and
 *  `ShelfSection` already renders nothing for an empty list, so this needs
 *  no extra loading guard beyond the `?? []` defaults below. */
export function QuickDialsShelves() {
  const { play } = useMusic()
  const { data: topTracks } = useTopTracks()
  const { data: recent } = useRecentlyPlayed()

  const frequentlyItems: ShelfCardItem[] = (topTracks ?? []).map((track: TopTrack) => ({
    key: track.uri,
    name: track.name,
    secondary: track.artist,
    imageUrl: track.image_url,
    onTap: () =>
      play(
        track.uri,
        playOptionsFor({
          uri: track.uri,
          mediaType: 'track',
          name: track.name,
          artist: track.artist,
          artistUri: track.artist_uri,
          album: track.album,
          albumUri: track.album_uri,
          imageUrl: track.image_url,
        }),
      ),
  }))

  const recentlyItems: ShelfCardItem[] = (recent ?? []).map((item: RecentItem) => ({
    key: item.uri,
    name: item.name,
    secondary: item.artist ?? typeLabel(item.media_type),
    imageUrl: item.image_url ?? null,
    onTap: () =>
      play(
        item.uri,
        playOptionsFor({
          uri: item.uri,
          mediaType: item.media_type,
          name: item.name,
          artist: item.artist,
          artistUri: item.artist_uri,
          album: item.album,
          albumUri: item.album_uri,
          imageUrl: item.image_url,
        }),
      ),
  }))

  if (frequentlyItems.length === 0 && recentlyItems.length === 0) {
    return (
      <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15, color: 'var(--ink-muted)' }}>
        Play something to build your quick dials.
      </div>
    )
  }

  return (
    <>
      <ShelfSection title="Frequently played" items={frequentlyItems} maxRows={FREQUENTLY_PLAYED_MAX_ROWS} />
      <ShelfSection
        title="Recently played"
        titleColor="var(--ink-muted)"
        items={recentlyItems}
        maxRows={RECENTLY_PLAYED_MAX_ROWS}
      />
    </>
  )
}

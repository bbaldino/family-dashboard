import { useNavigate } from 'react-router-dom'
import { useMusic, useTopTracks, useRecentlyPlayed } from '@/data/music'
import type { TopTrack, RecentItem } from '@/data/music'
import { ShelfSection } from './ShelfSection'
import type { ShelfCardItem } from './ShelfCard'
import type { PlayableItem } from './play'
import { playOptionsFor } from './play'
import { buildShelfActionGroups } from './build-shelf-action-groups'
import { typeLabel } from './labels'
import { FREQUENTLY_PLAYED_MAX_ROWS, RECENTLY_PLAYED_MAX_ROWS } from './shelf-capacity'

/** The "Quick Dials" tab content: the two shelves, mock `media.jsx:131-169`.
 *  Every hook here can boot with no data on a cold cache — both `useQuery`
 *  calls return `data: undefined` until their first fetch resolves, and
 *  `ShelfSection` already renders nothing for an empty list, so this needs
 *  no extra loading guard beyond the `?? []` defaults below.
 *
 * `openMenuUri`/`onToggleMenu`/`onCloseMenu` are `Media.tsx`'s own
 * track-actions-menu state, threaded down the same way `Album.tsx`/`Artist.tsx`
 * thread theirs into `RecordRunningOrder`/`ProfileTopTracks` — this screen
 * just has three possible bodies sharing the one piece of state instead of
 * one. */
export function QuickDialsShelves({
  openMenuUri,
  onToggleMenu,
  onCloseMenu,
}: {
  openMenuUri: string | null
  onToggleMenu: (uri: string) => void
  onCloseMenu: () => void
}) {
  const { play } = useMusic()
  const navigate = useNavigate()
  const { data: topTracks } = useTopTracks()
  const { data: recent } = useRecentlyPlayed()

  const toCardItem = (playable: PlayableItem, secondary: string): ShelfCardItem => ({
    key: playable.uri,
    name: playable.name,
    secondary,
    imageUrl: playable.imageUrl ?? null,
    onTap: () => play(playable.uri, playOptionsFor(playable)),
    menu: {
      isOpen: openMenuUri === playable.uri,
      onToggle: () => onToggleMenu(playable.uri),
      kicker: typeLabel(playable.mediaType),
      title: playable.name,
      groups: buildShelfActionGroups({ item: playable, play, navigate, onClose: onCloseMenu }),
    },
  })

  const frequentlyItems: ShelfCardItem[] = (topTracks ?? []).map((track: TopTrack) =>
    toCardItem(
      {
        uri: track.uri,
        mediaType: 'track',
        name: track.name,
        artist: track.artist,
        artistUri: track.artist_uri,
        album: track.album,
        albumUri: track.album_uri,
        imageUrl: track.image_url,
      },
      track.artist,
    ),
  )

  const recentlyItems: ShelfCardItem[] = (recent ?? []).map((item: RecentItem) =>
    toCardItem(
      {
        uri: item.uri,
        mediaType: item.media_type,
        name: item.name,
        artist: item.artist,
        artistUri: item.artist_uri,
        album: item.album,
        albumUri: item.album_uri,
        imageUrl: item.image_url,
      },
      item.artist ?? typeLabel(item.media_type),
    ),
  )

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

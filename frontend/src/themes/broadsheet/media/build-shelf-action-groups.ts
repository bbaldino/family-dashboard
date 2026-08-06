import type { PlayOptions } from '@/integrations/music'
import type { PlayableItem } from './play'
import { encodeUriParam } from './track-url'
import type { TrackActionsMenuGroup } from './TrackActionsMenu'

/**
 * The Play/Go-to groups for one Listening Room card's menu — the shelf/for-you/
 * search grid's equivalent of `build-track-action-groups.ts`, which only
 * covers a single track shape (`ArtistTrack`). A shelf card's item can be a
 * track, an album, an artist, or a playlist (`QuickDialsShelves`'s "recently
 * played", and every bucket of `SearchResultsPanel`'s results) — all four
 * already collapse to the same `PlayableItem` shape before they reach a card
 * (`play.ts`), so this builds off that instead of forking four near-copies
 * of `build-track-action-groups.ts`.
 *
 * **Which actions apply, and why:** a card's own tap already plays the item
 * outright — `playOptionsFor` (`play.ts`) gives a track `radio: true` (play
 * *and* continue with similar music) and everything else `radio: false`
 * (play it, start to finish, exactly as-is). So for a track, "Play just
 * this track" (`radio: false`) is a genuinely different choice from the
 * tap's own default — it's kept. For every other type, "play it as-is" is
 * already what tapping the card does, so offering it again in the menu
 * would just repeat the tap; it's dropped. "Play radio from this",
 * "Play next", and "Add to queue" are all real, distinct actions no tap can
 * reach for *any* type MA can enqueue, so all three are offered regardless
 * of media type — this is also why `ForYouShelf`'s playlists still get a
 * useful, non-empty menu despite never getting "Play just this X" or any
 * "Go to" entry.
 *
 * "Go to artist"/"Go to album" reuse `build-track-action-groups.ts`'s own
 * rule verbatim: included only when the item actually carries that uri.
 * The data itself only ever populates `artistUri`/`albumUri` for the types
 * where the target is meaningful (a track or album's performing artist, a
 * track's containing album) — an artist has no `artistUri` pointing
 * elsewhere, and nothing has an `albumUri` but a track — so this needs no
 * extra `mediaType` branching to keep "Go to album" off an album's own row
 * (a plain object-shape check already gets it right).
 */
export function buildShelfActionGroups({
  item,
  play,
  navigate,
  onClose,
}: {
  item: PlayableItem
  play: (uri: string, options?: PlayOptions) => void
  navigate: (path: string) => void
  onClose: () => void
}): TrackActionsMenuGroup[] {
  const run = (fn: () => void) => {
    fn()
    onClose()
  }

  const isTrack = item.mediaType === 'track'
  const base: PlayOptions = {
    mediaType: item.mediaType,
    name: item.name,
    artist: item.artist ?? undefined,
    artistUri: item.artistUri ?? undefined,
    album: item.album ?? undefined,
    albumUri: item.albumUri ?? undefined,
    imageUrl: item.imageUrl ?? undefined,
  }

  return [
    {
      label: 'Play',
      items: [
        ...(isTrack
          ? [
              {
                label: 'Play just this track',
                onSelect: () =>
                  run(() => play(item.uri, { ...base, radio: false, enqueueMode: 'play' })),
              },
            ]
          : []),
        {
          label: 'Play radio from this',
          onSelect: () => run(() => play(item.uri, { ...base, radio: true, enqueueMode: 'play' })),
        },
        {
          label: 'Play next',
          onSelect: () => run(() => play(item.uri, { ...base, radio: false, enqueueMode: 'next' })),
        },
        {
          label: 'Add to queue',
          onSelect: () => run(() => play(item.uri, { ...base, radio: false, enqueueMode: 'add' })),
        },
      ],
    },
    {
      label: 'Go to',
      items: [
        ...(item.artistUri
          ? [
              {
                label: 'Go to artist',
                onSelect: () =>
                  run(() => navigate(`/media/artist/${encodeUriParam(item.artistUri!)}`)),
              },
            ]
          : []),
        ...(item.albumUri
          ? [
              {
                label: 'Go to album',
                onSelect: () =>
                  run(() => navigate(`/media/album/${encodeUriParam(item.albumUri!)}`)),
              },
            ]
          : []),
      ],
    },
  ]
}

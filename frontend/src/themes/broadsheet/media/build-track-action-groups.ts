import type { ArtistTrack, PlayOptions } from '@/data/music'
import { trackPlayOptions } from './track-play'
import { encodeUriParam } from './track-url'
import type { TrackActionsMenuGroup } from './TrackActionsMenu'

/**
 * The six-action `Play`/`Go to` groups for one track's menu — identical
 * wiring on both The Record and The Profile (design brief: "All six actions
 * now work"), so it's built once here rather than duplicated between
 * `Album.tsx` and `Artist.tsx`.
 *
 * `Go to artist`/`Go to album` are omitted, not disabled, when the track's
 * own `artist_uri`/`album_uri` is null — `TrackActionsMenu.tsx` already
 * drops a group with no items, so an all-null track's menu just keeps its
 * `Play` group, the same defensive shape grid's own `TrackActionsMenu`
 * takes (read for reference only, nothing imported).
 *
 * Every action runs `onClose` after firing — the menu doesn't linger open
 * over whatever it just navigated to or queued.
 */
export function buildTrackActionGroups({
  track,
  play,
  navigate,
  onClose,
}: {
  track: ArtistTrack
  play: (uri: string, options?: PlayOptions) => void
  navigate: (path: string) => void
  onClose: () => void
}): TrackActionsMenuGroup[] {
  const run = (fn: () => void) => {
    fn()
    onClose()
  }

  return [
    {
      label: 'Play',
      items: [
        { label: 'Play just this track', onSelect: () => run(() => play(track.uri, trackPlayOptions(track, { radio: false, enqueueMode: 'play' }))) },
        { label: 'Play radio from this', onSelect: () => run(() => play(track.uri, trackPlayOptions(track, { radio: true, enqueueMode: 'play' }))) },
        { label: 'Play next', onSelect: () => run(() => play(track.uri, trackPlayOptions(track, { radio: false, enqueueMode: 'next' }))) },
        { label: 'Add to queue', onSelect: () => run(() => play(track.uri, trackPlayOptions(track, { radio: false, enqueueMode: 'add' }))) },
      ],
    },
    {
      label: 'Go to',
      items: [
        ...(track.artist_uri
          ? [{ label: 'Go to artist', onSelect: () => run(() => navigate(`/media/artist/${encodeUriParam(track.artist_uri!)}`)) }]
          : []),
        ...(track.album_uri
          ? [{ label: 'Go to album', onSelect: () => run(() => navigate(`/media/album/${encodeUriParam(track.album_uri!)}`)) }]
          : []),
      ],
    },
  ]
}

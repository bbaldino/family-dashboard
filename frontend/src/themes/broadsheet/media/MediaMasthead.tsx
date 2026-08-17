import { MastheadFrame } from '@/themes/broadsheet/ui/MastheadFrame'
import { mastheadKickerStyle, mastheadNumeralStyle } from '@/themes/broadsheet/ui/masthead-styles'
import { useNow } from '@/themes/broadsheet/home/useNow'
import { RoomEar } from './RoomEar'

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

/**
 * Media's masthead — the shared three-column `MastheadFrame`, following the
 * suite's masthead rule: the centre names the page, and no ear is a second
 * name.
 *
 * **The centre names the page.** It used to carry the anchored room — "Now
 * playing in / the Kitchen and Deck" — which the left ear now covers more
 * completely, since it lists every room rather than only the anchor's group.
 * The room-label logic itself is untouched and still drives the Centre
 * Spread, where naming the room is the whole point of the screen.
 *
 * **The left ear is the room picker** (`RoomEar`, shared with the Centre
 * Spread). It was "Section IV / The Listening Room", a name for a page the
 * nav tab already labels.
 *
 * **The right ear is empty.** The design puts library counts there (tracks,
 * albums, playlists) and no route reports them: music exposes `/search`,
 * `/recent`, `/top-tracks`, `/artist` and `/album`, none of which is a total.
 * Left blank rather than filled with a number we would have to invent.
 */
export function MediaMasthead() {
  const now = useNow()

  return (
    <MastheadFrame
      left={<RoomEar />}
      center={
        <>
          <div style={{ ...mastheadKickerStyle, textAlign: 'center' }}>
            {DATE_FORMAT.format(now)}
          </div>
          <h1 className="m-0" style={mastheadNumeralStyle}>
            Media
          </h1>
        </>
      }
      right={null}
    />
  )
}

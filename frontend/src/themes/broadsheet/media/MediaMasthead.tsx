import { MastheadFrame } from '@/themes/broadsheet/ui/MastheadFrame'
import { mastheadKickerStyle, mastheadNumeralStyle } from '@/themes/broadsheet/ui/masthead-styles'
import { useNow } from '@/themes/broadsheet/home/useNow'

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

/**
 * Media's masthead — the shared three-column `MastheadFrame`, following the
 * suite's masthead rule: the centre names the page.
 *
 * **Both ears are empty.** The left ear used to carry the room picker
 * (`RoomEar`), but with several rooms in the house it stacked taller than the
 * numeral opposite and stretched the whole bar. The picker still lives on the
 * Centre Spread (the full now-playing view), which is where directing audio to
 * a room really belongs — a fitting home for it in this header is left to the
 * redesign. The right ear would hold library counts (tracks, albums,
 * playlists), but no music route reports them, so it stays blank rather than
 * inventing a number.
 */
export function MediaMasthead() {
  const now = useNow()

  return (
    <MastheadFrame
      left={null}
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

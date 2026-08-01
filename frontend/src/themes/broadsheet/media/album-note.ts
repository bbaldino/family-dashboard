/**
 * The Record's sleeve note — one dry declarative sentence, the album-page
 * equivalent of Home's `buildStandfirst` (`home/standfirst.ts`).
 *
 * **This is the primary content, not a placeholder.** `AlbumDetail.description`
 * comes from Music Assistant's metadata enrichment, which only runs for
 * library items — this household's library is empty, so `description` is
 * null in practice for every album, real or fixture (see `useAlbumDetail.ts`'s
 * own header comment). `Album.tsx` renders `description` when present and
 * this generated line otherwise, and the generated line is what will
 * actually be on screen, so it's written to read as well as the editorial
 * copy it stands in for — not as a "no description available" apology.
 *
 * Composed from the same four fields the sleeve's own credits `<dl>` shows
 * (`Released`/`Label`/`Length`), per the design brief — nothing invented,
 * everything already on the page in another form, just turned into a
 * sentence instead of a table.
 */
import { formatRuntimeMinutes } from './album-runtime'

export interface AlbumNoteInput {
  year: number | null
  label: string | null
  trackCount: number
  /** Total album duration, in seconds — the sum of every track's
   *  `duration` (see `album-runtime.ts`'s `sumDurationSeconds`). */
  runtimeSeconds: number
}

function releaseClause(year: number | null, label: string | null): string | null {
  if (year && label) return `Released ${year} on ${label}`
  if (year) return `Released ${year}`
  if (label) return `Released on ${label}`
  return null
}

function trackWord(count: number): string {
  return count === 1 ? '1 track' : `${count} tracks`
}

export function buildAlbumNote(input: AlbumNoteInput): string {
  const release = releaseClause(input.year, input.label)

  if (input.trackCount === 0) {
    return release ? `${release}. No tracks logged.` : 'No tracks logged.'
  }

  const length = `${trackWord(input.trackCount)}, running ${formatRuntimeMinutes(input.runtimeSeconds)}`
  const sentence = release ? `${release} — ${length}` : length[0].toUpperCase() + length.slice(1)
  return `${sentence}.`
}

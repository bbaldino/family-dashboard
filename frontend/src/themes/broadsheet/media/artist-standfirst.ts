/**
 * The Profile's standfirst — one dry declarative sentence, the artist-page
 * sibling of `album-note.ts` and Home's `buildStandfirst` (`home/standfirst.ts`).
 *
 * **This is the primary content, not a placeholder.** `ArtistDetail.description`
 * is null in practice for the same reason `AlbumDetail.description` is (see
 * `album-note.ts`'s header comment): Music Assistant only enriches library
 * items, and this household's library is empty. `Artist.tsx` renders
 * `description` when present and this generated line otherwise, and the
 * generated line is what will actually be on screen.
 *
 * Composed from `genres[]` — verified populated for real artists (design
 * brief: e.g. "breakbeat, big beat, electronic") — and the album count
 * already shown in the discography rail, per the design brief.
 */

export interface ArtistStandfirstInput {
  genres: string[]
  albumCount: number
}

function genreClause(genres: string[]): string | null {
  if (genres.length === 0) return null
  return genres.join(', ')
}

function albumClause(count: number): string {
  if (count === 0) return 'no albums in the library'
  if (count === 1) return '1 album in the library'
  return `${count} albums in the library`
}

function capitalize(text: string): string {
  return text.length > 0 ? text[0].toUpperCase() + text.slice(1) : text
}

export function buildArtistStandfirst(input: ArtistStandfirstInput): string {
  const genres = genreClause(input.genres)
  const albums = albumClause(input.albumCount)
  const sentence = genres ? `${genres} — ${albums}` : albums
  return `${capitalize(sentence)}.`
}

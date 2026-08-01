import type { ArtistAlbumSummary } from '@/data/music'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'
import { Cover } from './Cover'
import { MAX_DISCOGRAPHY_ALBUMS } from './profile-capacity'

/**
 * The Profile's right rail — the discography, a 130px-cover grid (mock
 * `music-pages.jsx:255-269`). Capped at `MAX_DISCOGRAPHY_ALBUMS`; unlike the
 * two text lists elsewhere on these two pages, there's no "+N more" line
 * here — the rail has no room to spare for one without pushing a cover off
 * the bottom edge, the same trade `MediaMasthead.tsx`'s room-pill cap
 * documents for its own tighter cell.
 */
export function ProfileDiscography({ albums, onOpenAlbum }: { albums: ArtistAlbumSummary[]; onOpenAlbum: (uri: string) => void }) {
  const visible = albums.slice(0, MAX_DISCOGRAPHY_ALBUMS)

  return (
    <aside className="min-h-0 flex flex-col" style={{ padding: '18px 56px 18px 28px' }}>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 8 }}>
        <Kicker color="var(--ink-muted)">Discography</Kicker>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)', letterSpacing: '0.12em' }}>
          {albums.length === 1 ? '1 album' : `${albums.length} albums`}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, borderTop: '2px solid var(--ink)', paddingTop: 12 }}>
        {visible.map((album) => (
          <button
            key={album.uri}
            type="button"
            onClick={() => onOpenAlbum(album.uri)}
            className="text-left"
            style={{ all: 'unset', cursor: 'pointer' }}
          >
            <Cover imageUrl={album.image_url} name={album.name} size={130} />
            <div className="truncate" style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, lineHeight: 1.2, marginTop: 6 }}>
              {album.name}
            </div>
            {album.year && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)', letterSpacing: '0.1em', marginTop: 1 }}>
                {album.year}
              </div>
            )}
          </button>
        ))}
      </div>
    </aside>
  )
}

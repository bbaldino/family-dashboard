import type { AlbumDetail } from '@/data/music'
import { Cover } from './Cover'
import { INK2 } from './colors'
import { sumDurationSeconds, formatRuntimeMinutes } from './album-runtime'
import { buildAlbumNote } from './album-note'

const EMPTY = '—'

const dtStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  letterSpacing: '0.2em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-muted)',
}

const ddStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: 14.5,
  fontWeight: 500,
  margin: 0,
  lineHeight: 1.25,
}

const footActionStyle = {
  all: 'unset' as const,
  cursor: 'pointer',
  flex: 1,
  textAlign: 'center' as const,
  padding: '6px 10px',
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  letterSpacing: '0.16em',
  textTransform: 'uppercase' as const,
  border: '1px solid var(--rule)',
  color: 'var(--ink-muted)',
}

/**
 * The left margin — sleeve, artist byline, album note, credits, and the two
 * queue actions pinned to the column's foot (mock `music-pages.jsx:135-152`).
 *
 * **`description` when present, `buildAlbumNote`'s generated line otherwise**
 * (`album-note.ts`'s own header comment): `description` is null in practice
 * for essentially every album today, so the generated line is the one that
 * actually renders.
 *
 * **Two foot buttons, not the mock's three.** The mock draws
 * `Shuffle · Queue · Radio`. Checked against `backend/src/integrations/music/routes.rs`'s
 * `play` handler, the same way `CentreSpreadRunningOrder.tsx`'s own header
 * comment already documents for its own dropped Shuffle/Repeat row: `option`
 * only ever becomes `play`/`next`/`add` (`enqueue_mode`), and there's no
 * shuffle parameter sent anywhere — only `debug_command`, which isn't meant
 * for product UI. `radio_mode` and `add`, unlike shuffle, are both real,
 * uri-agnostic options the same `play_media` call already takes, so `Queue`
 * (add the album to the queue) and `Radio` (start radio from it) are wired;
 * `Shuffle` is dropped rather than rendered inert.
 */
export function RecordSleeve({
  album,
  onQueue,
  onRadio,
}: {
  album: AlbumDetail
  onQueue: () => void
  onRadio: () => void
}) {
  const runtimeSeconds = sumDurationSeconds(album.tracks)
  const note =
    album.description ??
    buildAlbumNote({
      year: album.year,
      label: album.label,
      trackCount: album.tracks.length,
      runtimeSeconds,
    })

  const rows: [string, string][] = [
    ['Released', album.year ? String(album.year) : EMPTY],
    ['Label', album.label ?? EMPTY],
    [
      'Length',
      `${album.tracks.length === 1 ? '1 track' : `${album.tracks.length} tracks`} · ${formatRuntimeMinutes(runtimeSeconds)}`,
    ],
  ]

  return (
    <aside
      className="min-h-0 flex flex-col"
      style={{ padding: '20px 28px 20px 56px', borderRight: '1px solid var(--rule)' }}
    >
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <Cover imageUrl={album.image_url} name={album.name} size={274} />
        <div
          style={{
            position: 'absolute',
            top: -6,
            left: -6,
            background: 'var(--rust)',
            color: 'var(--paper)',
            fontFamily: 'var(--font-mono)',
            fontSize: 8,
            letterSpacing: '0.18em',
            fontWeight: 700,
            padding: '2px 6px',
          }}
        >
          PLATE I
        </div>
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: 20,
          color: INK2,
          marginTop: 14,
          lineHeight: 1.25,
        }}
      >
        {album.artist ?? 'Unknown artist'}
      </div>
      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 13.5,
          color: 'var(--ink-muted)',
          lineHeight: 1.45,
          marginTop: 8,
        }}
      >
        {note}
      </p>
      <dl className="m-0" style={{ marginTop: 14 }}>
        {rows.map(([label, value], i) => (
          <div
            key={label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              padding: '6px 0',
              borderTop: i === 0 ? '1px solid var(--ink)' : '1px dotted var(--rule)',
            }}
          >
            <dt style={dtStyle}>{label}</dt>
            <dd className="truncate" style={ddStyle}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <div
        style={{
          marginTop: 'auto',
          paddingTop: 14,
          borderTop: '1px solid var(--rule)',
          display: 'flex',
          gap: 6,
        }}
      >
        <button type="button" onClick={onQueue} style={footActionStyle}>
          Queue
        </button>
        <button type="button" onClick={onRadio} style={footActionStyle}>
          Radio
        </button>
      </div>
    </aside>
  )
}

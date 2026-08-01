import { Kicker } from '@/themes/broadsheet/ui/Kicker'

/**
 * The Profile's standfirst row, under the masthead (mock `music-pages.jsx:221-227`).
 *
 * **Two cells, not the mock's three.** The mock's right cell reads
 * `{from} · since {since} · {plays} plays` — none of `ArtistDetail`'s fields
 * back a hometown, a founding year, or a play count (design brief: "Artist:
 * `name`, `image_url`, `genres[]`, `description`, `top_tracks[]`,
 * `albums[]`"), so drawing that cell would mean inventing three numbers with
 * nothing behind them. Dropped rather than rendered with placeholder text,
 * the same call this project already made for the mock's Label row
 * elsewhere (`CentreSpreadCredits.tsx`'s own header comment).
 */
export function ProfileStandfirst({ text }: { text: string }) {
  return (
    <div
      className="flex items-baseline"
      style={{ padding: '10px 56px 12px', borderBottom: '1px solid var(--rule)', gap: 18 }}
    >
      <Kicker>↘ on the artist</Kicker>
      <p className="m-0 truncate" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, lineHeight: 1.4 }}>
        {text}
      </p>
    </div>
  )
}

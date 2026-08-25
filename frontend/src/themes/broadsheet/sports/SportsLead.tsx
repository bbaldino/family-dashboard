import { useState } from 'react'
import type { SportsTrack } from '@/integrations/sports'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'
import { SP_RULE } from './sports-tokens'

/**
 * The backend generates ink-on-cream engraving art for the lead story and
 * caches it (first request ~6s); we point an <img> straight at the route.
 */
function leadArtUrl(track: SportsTrack): string {
  const p = new URLSearchParams({
    league: track.league,
    team: track.team,
    headline: track.headline,
  })
  return `/api/sports/lead-art?${p.toString()}`
}

/**
 * The lead-art plate — the generated engraving that makes the page read as a
 * newspaper rather than a feed. Until the image loads, a light cream halftone
 * ground with a faint "Developing" marker stands in, tuned to match the
 * ink-on-cream art so the swap is seamless. On error the ground stays.
 */
function Plate({ height, caption, src }: { height: number; caption: string; src: string }) {
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)

  return (
    <div>
      <div
        style={{
          height,
          position: 'relative',
          overflow: 'hidden',
          borderTop: '2px solid var(--ink)',
          borderBottom: `1px solid ${SP_RULE}`,
          background: 'var(--paper)',
          backgroundImage:
            'radial-gradient(rgba(42,37,32,0.14) 1px, transparent 1.4px), radial-gradient(rgba(42,37,32,0.08) 1px, transparent 1.4px)',
          backgroundSize: '5px 5px, 5px 5px',
          backgroundPosition: '0 0, 2.5px 2.5px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ink-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
          }}
        >
          Developing
        </div>
        {!errored && (
          <img
            src={src}
            alt=""
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: loaded ? 1 : 0,
              transition: 'opacity 300ms ease',
            }}
          />
        )}
      </div>
      {caption && (
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 11,
            color: 'var(--ink-muted)',
            lineHeight: 1.35,
            paddingTop: 4,
          }}
        >
          {caption}
        </div>
      )}
    </div>
  )
}

/**
 * A league track's lead: headline, dek, wire plate (primary only), the big
 * record numeral with its standing, home/away splits, and the next fixture.
 *
 * The `primary` track gets the plate and the larger type; the second front of
 * a split runs the same anatomy one size down. On a single front the follow-up
 * stories sit under the lead with their deks; on a split, column 1 already
 * carries two leads, so the follow-ups move to column 4's "In brief" and this
 * renders without them (`showMore={false}`).
 */
export function SportsLead({
  track,
  primary,
  split,
  showMore,
}: {
  track: SportsTrack
  primary: boolean
  split: boolean
  showMore: boolean
}) {
  const teamShort = track.team.split(' ').slice(-1)[0]

  return (
    <div>
      <Kicker>
        {primary ? 'Lead' : 'Second front'} · {track.league} · {track.team}
      </Kicker>
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: primary ? (split ? 27 : 30) : 24,
          fontWeight: 600,
          letterSpacing: '-0.015em',
          lineHeight: 1.04,
          margin: '6px 0 7px',
        }}
      >
        {track.headline}
      </h2>
      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: primary ? 13.5 : 12.5,
          color: 'var(--ink-muted)',
          lineHeight: 1.42,
          margin: '0 0 9px',
        }}
      >
        {track.dek}
      </p>
      {primary && (
        <Plate height={split ? 96 : 112} caption={track.caption} src={leadArtUrl(track)} />
      )}

      <div
        style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: primary ? 10 : 2 }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: primary ? (split ? 40 : 44) : 36,
            fontWeight: 600,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          {track.record}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: primary ? 17 : 15,
            fontWeight: 600,
            color: 'var(--forest)',
          }}
        >
          {track.standing}
        </span>
      </div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9.5,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
          marginTop: 4,
        }}
      >
        Home {track.home} · Away {track.away}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          marginTop: 7,
          paddingTop: 6,
          borderTop: `1px solid ${SP_RULE}`,
        }}
      >
        <Kicker>Next</Kicker>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14.5, fontWeight: 600 }}>
          {track.next}
        </span>
      </div>

      {showMore && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '2px solid var(--ink)' }}>
          <Kicker color="var(--ink-muted)">More on the {teamShort}</Kicker>
          <div style={{ marginTop: 3 }}>
            {track.more.slice(0, 2).map((s) => (
              <div key={s.h} style={{ padding: '7px 0', borderTop: `1px dotted ${SP_RULE}` }}>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 14,
                    fontWeight: 600,
                    lineHeight: 1.2,
                  }}
                >
                  {s.h}
                </div>
                {s.dek && (
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontStyle: 'italic',
                      fontSize: 12,
                      color: 'var(--ink-muted)',
                      lineHeight: 1.35,
                      marginTop: 2,
                    }}
                  >
                    {s.dek}
                  </div>
                )}
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    letterSpacing: '0.12em',
                    color: 'var(--ink-muted)',
                    marginTop: 3,
                    textTransform: 'uppercase',
                  }}
                >
                  {s.meta}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

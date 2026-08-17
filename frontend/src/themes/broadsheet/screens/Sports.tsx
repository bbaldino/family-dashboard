import { useSportsSection } from '@/integrations/sports'
import type { SportsSection } from '@/integrations/sports'
import { MastheadFrame } from '@/themes/broadsheet/ui/MastheadFrame'
import { mastheadKickerStyle, mastheadNumeralStyle } from '@/themes/broadsheet/ui/masthead-styles'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'
import { useNow } from '@/themes/broadsheet/home/useNow'
import { SportsLead } from '@/themes/broadsheet/sports/SportsLead'
import { TableBlock, ScoreBlock, LeaderBlock } from '@/themes/broadsheet/sports/SportsBlocks'
import { StreakList, TrackLabel } from '@/themes/broadsheet/sports/SportsPrimitives'
import { CAPS, SP_RULE } from '@/themes/broadsheet/sports/sports-tokens'

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

const columnStyle = (last?: boolean) => ({
  padding: last ? '14px 56px 14px 22px' : '14px 22px',
  borderRight: last ? undefined : `1px solid ${SP_RULE}`,
  overflow: 'hidden' as const,
  minHeight: 0,
})

/** A double-rule divider above the second front's block in a lower column. */
const secondTrack = { marginTop: 12, paddingTop: 10, borderTop: '2px solid var(--ink)' }

/**
 * The Sporting Page — a league-level sports section, distinct from the
 * live-game panel that blooms inside Home.
 *
 * **`leagues` is the structural pivot.** One track leads a single front; two
 * run a split front down all four columns. The backend ranks leagues by season
 * type (Regular Season → Postseason → Preseason → off-season) and hands the top
 * one or two here as tracks, the rest as `elsewhere`. This screen never takes
 * more than two — three fronts on a 1600px wall are unreadable.
 *
 * Built and verified against `?scenario=sports-summer` (single) and
 * `sports-autumn` (split) before the aggregation endpoint exists; see
 * `useSportsSection`.
 *
 * Nothing here is tappable: the data inventory is explicit that articles carry
 * only a headline and a short dek, so there is nothing behind a tap worth
 * showing.
 */
export function Sports() {
  const now = useNow()
  const { data } = useSportsSection()

  // An empty `leagues` (no tracked teams, or every league's fetch failed) is
  // treated like no data at all: `SportsBody` reads `tracks[0]` for the
  // standfirst and Form, so it must never run without at least one track.
  if (!data || data.leagues.length === 0) {
    return (
      <div className="broadsheet-root w-[1600px] h-[900px] flex flex-col">
        <MastheadFrame
          padding="20px 56px 14px"
          left={null}
          center={
            <>
              <div style={{ ...mastheadKickerStyle, textAlign: 'center' }}>
                {DATE_FORMAT.format(now)}
              </div>
              <h1 className="m-0" style={mastheadNumeralStyle}>
                Sports
              </h1>
            </>
          }
          right={null}
        />
        <div
          className="flex-1 min-h-0 flex items-center justify-center"
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            color: 'var(--ink-muted)',
          }}
        >
          {data ? 'No sports to report.' : 'Checking the wires…'}
        </div>
        <div style={{ flexShrink: 0, height: 64 }} />
      </div>
    )
  }

  return <SportsBody section={data} now={now} />
}

function SportsBody({ section, now }: { section: SportsSection; now: Date }) {
  // Never more than two fronts. The backend already ranks and trims, but the
  // slice makes the "at most two" guarantee local and obvious.
  const tracks = section.leagues.slice(0, 2)
  const split = tracks.length > 1
  const caps = split ? CAPS.split : CAPS.single

  // "In brief" carries the elsewhere leagues always, plus — on a split — each
  // front's top follow-up, which column 1 no longer has room for. Normalised to
  // one shape so the two sources concatenate: a follow-up's dek is dropped here,
  // since In brief is headline-only.
  const briefs: { league: string; story: { h: string; meta: string } }[] = [
    ...(split
      ? tracks.map((t) => ({ league: t.league, story: { h: t.more[0].h, meta: t.more[0].meta } }))
      : []),
    ...section.elsewhere.map((e) => ({ league: e.league, story: e.story })),
  ]

  return (
    <div className="broadsheet-root w-[1600px] h-[900px] flex flex-col">
      <MastheadFrame
        padding="20px 56px 14px"
        left={
          <>
            <div style={mastheadKickerStyle}>Next up</div>
            <div className="flex flex-col" style={{ gap: 1 }}>
              {section.fixtures.map((f) => (
                <div key={f.team} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 14,
                      fontWeight: 600,
                      minWidth: 68,
                    }}
                  >
                    {f.team}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.06em',
                      color: 'var(--ink-muted)',
                    }}
                  >
                    {f.detail}
                  </span>
                </div>
              ))}
            </div>
          </>
        }
        center={
          <>
            <div style={{ ...mastheadKickerStyle, textAlign: 'center' }}>
              {DATE_FORMAT.format(now)}
            </div>
            <h1 className="m-0" style={mastheadNumeralStyle}>
              Sports
            </h1>
          </>
        }
        right={
          <>
            <div style={{ ...mastheadKickerStyle, textAlign: 'right' }}>Season</div>
            <div className="flex flex-col" style={{ gap: 1 }}>
              {section.clock.map((c) => (
                <div
                  key={c.league}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'flex-end',
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.06em',
                      color: 'var(--ink-muted)',
                    }}
                  >
                    {c.detail}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 14,
                      fontWeight: 600,
                      minWidth: 34,
                      textAlign: 'right',
                    }}
                  >
                    {c.league}
                  </span>
                </div>
              ))}
            </div>
          </>
        }
      />

      {/* Standfirst */}
      <div
        className="grid items-baseline flex-shrink-0"
        style={{
          gridTemplateColumns: 'auto 1fr auto',
          gap: 18,
          padding: '9px 56px 11px',
          borderBottom: `1px solid ${SP_RULE}`,
        }}
      >
        <Kicker>↘ from the house</Kicker>
        <p
          className="m-0"
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 15.5,
            lineHeight: 1.4,
          }}
        >
          {section.standfirst}{' '}
          <span style={{ color: 'var(--ink-muted)' }}>— warmly, the house.</span>
        </p>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--ink-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          {tracks.map((t) => t.league).join(' + ')} · {tracks[0].seasonType}
        </span>
      </div>

      {/* Body: four columns, one or two tracks deep */}
      <div
        data-testid="sports-body"
        className="flex-1 min-h-0 grid"
        style={{ gridTemplateColumns: '1.35fr 0.95fr 0.95fr 0.95fr' }}
      >
        {/* Col 1 — the front */}
        <section data-testid="sports-col-1" style={{ ...columnStyle(), paddingLeft: 56 }}>
          {tracks.map((t, i) => (
            <div
              key={t.league}
              style={
                i === 0
                  ? undefined
                  : { marginTop: 12, paddingTop: 12, borderTop: '3px double var(--ink)' }
              }
            >
              <SportsLead track={t} primary={i === 0} split={split} showMore={!split} />
            </div>
          ))}
        </section>

        {/* Col 2 — the table, form, elsewhere */}
        <section data-testid="sports-col-2" style={columnStyle()}>
          <Kicker>The Table</Kicker>
          {tracks.map((t, i) => (
            <div
              key={t.league}
              style={
                i === 0
                  ? undefined
                  : { marginTop: 10, paddingTop: 8, borderTop: '2px solid var(--ink)' }
              }
            >
              {split && <TrackLabel track={t} />}
              <TableBlock track={t} maxRows={caps.tableRows} split={split} />
            </div>
          ))}

          <div style={{ marginTop: 12, paddingTop: 9, borderTop: '2px solid var(--ink)' }}>
            {/* Streak is the only form signal in the feed, so it earns a
                sidebar. On a split it shows the primary league only, and says
                which — one league's streaks beside two tables would mislead. */}
            <Kicker color="var(--ink-muted)">Form{split ? ` · ${tracks[0].league}` : ''}</Kicker>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 7 }}>
              <StreakList label="Running hot" rows={tracks[0].hot} />
              <StreakList label="Cold snap" rows={tracks[0].cold} />
            </div>
          </div>

          <div style={{ marginTop: 14, paddingTop: 10, borderTop: '2px solid var(--ink)' }}>
            <Kicker color="var(--ink-muted)">Elsewhere</Kicker>
            <div style={{ marginTop: 5 }}>
              {section.elsewhere.map((e, i) => (
                <div
                  key={e.league}
                  style={{
                    padding: '7px 0',
                    borderTop: i === 0 ? 'none' : `1px dotted ${SP_RULE}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span
                      style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600 }}
                    >
                      {e.team}
                    </span>
                    <span style={{ flex: 1 }} />
                    {e.record ? (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          color: 'var(--ink)',
                        }}
                      >
                        {e.record}
                        {e.tag && (
                          <span
                            style={{
                              fontSize: 9,
                              color: 'var(--ink-muted)',
                              letterSpacing: '0.12em',
                              marginLeft: 5,
                            }}
                          >
                            {e.tag.toUpperCase()}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          letterSpacing: '0.14em',
                          color: 'var(--ink-muted)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {e.tag || 'off-season'}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontStyle: 'italic',
                      fontSize: 12,
                      color: 'var(--ink-muted)',
                      marginTop: 1,
                    }}
                  >
                    {e.note}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Col 3 — around the league */}
        <section data-testid="sports-col-3" style={columnStyle()}>
          <Kicker>Around the League</Kicker>
          {tracks.map((t, i) => (
            <div key={t.league} style={i === 0 ? undefined : secondTrack}>
              {split && <TrackLabel track={t} />}
              <ScoreBlock track={t} maxScores={caps.scores} split={split} />
            </div>
          ))}
        </section>

        {/* Col 4 — leaders + briefs */}
        <section data-testid="sports-col-4" style={columnStyle(true)}>
          <Kicker>Season Leaders</Kicker>
          {tracks.map((t, i) => {
            // Indexed off CAPS directly so the tuple/number split narrows —
            // `caps.leaderCats` on the merged `caps` widens to their union.
            const n = split ? CAPS.split.leaderCats[i] : CAPS.single.leaderCats
            return (
              <div
                key={t.league}
                style={
                  i === 0
                    ? { marginTop: 6 }
                    : { marginTop: 8, paddingTop: 8, borderTop: '2px solid var(--ink)' }
                }
              >
                {split && (
                  <div style={{ marginBottom: 4 }}>
                    <TrackLabel track={t} />
                  </div>
                )}
                <LeaderBlock track={t} maxCats={n} />
              </div>
            )
          })}

          {/* News flows year-round even when records don't. On a split this also
              carries the two leads' follow-ups, which column 1 has no room for. */}
          <div style={{ marginTop: 2, paddingTop: 9, borderTop: '2px solid var(--ink)' }}>
            <Kicker color="var(--ink-muted)">In brief</Kicker>
            <div style={{ marginTop: 3 }}>
              {briefs.map((e, i) => (
                <div
                  key={`${e.league}-${e.story.h}`}
                  style={{
                    padding: '5px 0',
                    borderTop: i === 0 ? 'none' : `1px dotted ${SP_RULE}`,
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'var(--rust)',
                      marginBottom: 2,
                    }}
                  >
                    {e.league}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 13,
                      fontWeight: 600,
                      lineHeight: 1.22,
                    }}
                  >
                    {e.story.h}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      letterSpacing: '0.12em',
                      color: 'var(--ink-muted)',
                      marginTop: 2,
                      textTransform: 'uppercase',
                    }}
                  >
                    {e.story.meta}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div style={{ flexShrink: 0, height: 64 }} />
    </div>
  )
}

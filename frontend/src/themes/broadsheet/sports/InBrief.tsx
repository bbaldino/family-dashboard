import type { BriefItem } from '@/integrations/sports'
import { formatNewsAge } from '@/integrations/sports'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'
import { shownFitStyle, hiddenFitStyle } from '@/themes/broadsheet/fit-styles'
import { SP_RULE, clampLines } from './sports-tokens'

const meta = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  letterSpacing: '0.14em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-muted)',
}

/** The block's own frame above its heading — top margin, padding and rule —
 *  in px. Exported so a fitting parent can count it without measuring: the
 *  frame is the part of the block's height no item or heading accounts for. */
const FRAME = { marginTop: 10, paddingTop: 7, rule: 1 }
export const BRIEF_FRAME_HEIGHT = FRAME.marginTop + FRAME.paddingTop + FRAME.rule

/**
 * A column's headlines: the team's own first, then the league's (tagged in
 * rust so the two read apart). The newest `deks` items carry their summary
 * as a dek; the rest are headline only. Headlines and deks each clamp to two
 * lines, so every item has a known maximum height.
 *
 * Up to `max` items are candidates; the first `shown` of them (all of them
 * by default) are visible and the rest are named in "+N more". Hidden
 * candidates stay mounted, laid out but invisible, so a fitting parent
 * (`LeagueColumn`) can measure them by `data-brief-item` — as it measures the
 * heading (`data-brief-head`) and the "+N more" line (`data-brief-more`),
 * which is kept mounted for measuring even when nothing is held back, and
 * hidden when `more` is false (the parent measured no room for it).
 */
export function InBrief({
  items,
  max,
  deks,
  now,
  shown,
  more = true,
}: {
  items: BriefItem[]
  max: number
  deks: number
  now: Date
  shown?: number
  more?: boolean
}) {
  const candidates = items.slice(0, max)
  const count = Math.min(shown ?? candidates.length, candidates.length)
  const hidden = items.length - count
  return (
    <div
      data-testid="in-brief"
      style={{
        position: 'relative',
        marginTop: FRAME.marginTop,
        paddingTop: FRAME.paddingTop,
        borderTop: `${FRAME.rule}px solid var(--ink)`,
      }}
    >
      <div data-brief-head="" style={shownFitStyle}>
        <Kicker color="var(--ink-muted)">In brief</Kicker>
      </div>
      {candidates.length === 0 && (
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            color: 'var(--ink-muted)',
            marginTop: 6,
          }}
        >
          No news right now.
        </div>
      )}
      {candidates.map((b, i) => (
        <div
          key={`${i}-${b.tag}-${b.h}`}
          data-brief-item={i}
          style={i < count ? shownFitStyle : hiddenFitStyle}
          aria-hidden={i < count ? undefined : true}
        >
          <div style={{ padding: '5px 0', borderTop: i === 0 ? 'none' : `1px dotted ${SP_RULE}` }}>
            <div style={meta}>
              <span style={{ color: b.source === 'league' ? 'var(--rust)' : undefined }}>
                {b.tag}
              </span>
              {b.publishedAt && <span> · {formatNewsAge(b.publishedAt, now)}</span>}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.22,
                ...clampLines(2),
              }}
            >
              {b.h}
            </div>
            {i < deks && b.dek && (
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontStyle: 'italic',
                  fontSize: 12.5,
                  color: 'var(--ink-muted)',
                  marginTop: 1,
                  ...clampLines(2),
                }}
              >
                {b.dek}
              </div>
            )}
          </div>
        </div>
      ))}
      {candidates.length > 0 && (
        <div
          data-brief-more=""
          style={more && hidden > 0 ? shownFitStyle : hiddenFitStyle}
          aria-hidden={more && hidden > 0 ? undefined : true}
        >
          <div style={{ ...meta, paddingTop: 4, borderTop: `1px dotted ${SP_RULE}` }}>
            +{hidden} more
          </div>
        </div>
      )}
    </div>
  )
}

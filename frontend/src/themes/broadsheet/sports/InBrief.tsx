import type { BriefItem } from '@/integrations/sports'
import { formatNewsAge } from '@/integrations/sports'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'
import { SP_RULE } from './sports-tokens'

const meta = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  letterSpacing: '0.14em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-muted)',
}

/**
 * A column's headlines: the team's own first, then the league's (tagged in
 * rust so the two read apart). The newest `deks` items carry their one-line
 * summary; the rest are headline only. Capped at `max` with "+N more".
 */
export function InBrief({
  items,
  max,
  deks,
  now,
}: {
  items: BriefItem[]
  max: number
  deks: number
  now: Date
}) {
  const shown = items.slice(0, max)
  const hidden = items.length - shown.length
  return (
    <div
      data-testid="in-brief"
      style={{ marginTop: 10, paddingTop: 7, borderTop: '1px solid var(--ink)' }}
    >
      <Kicker color="var(--ink-muted)">In brief</Kicker>
      {shown.length === 0 && (
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
      {shown.map((b, i) => (
        <div
          key={`${b.tag}-${b.h}`}
          style={{ padding: '5px 0', borderTop: i === 0 ? 'none' : `1px dotted ${SP_RULE}` }}
        >
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
              }}
            >
              {b.dek}
            </div>
          )}
        </div>
      ))}
      {hidden > 0 && (
        <div style={{ ...meta, paddingTop: 4, borderTop: `1px dotted ${SP_RULE}` }}>
          +{hidden} more
        </div>
      )}
    </div>
  )
}

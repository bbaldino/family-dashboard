import type { CSSProperties } from 'react'
import type { SportColumn } from '@/integrations/sports'
import { formatFinalDate, formatUpcomingTime } from '@/integrations/sports'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'
import { SP_RULE } from './sports-tokens'

const monoMuted: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9.5,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--ink-muted)',
}

const gameLine: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 10,
  padding: '4px 0',
  borderTop: `1px dotted ${SP_RULE}`,
  fontFamily: 'var(--font-display)',
  fontSize: 14,
}

const vs = (homeAway: 'home' | 'away', opponent: string) =>
  homeAway === 'home' ? `vs ${opponent}` : `@ ${opponent}`

/**
 * The head of a league column: how the followed team stands and what's next.
 *
 * Three shapes, by phase. Regular season leads with the record and standing
 * and a form line; the postseason leads with the series status (or how the
 * season ended) since the record no longer matters; preseason and off-season
 * keep to the next game. LAST and NEXT drop out on their own when the
 * schedule couldn't be read — the card never shows an empty line.
 */
export function TeamCard({ column }: { column: SportColumn }) {
  const { card, phase } = column
  const compact = phase === 'preseason' || phase === 'offseason'
  const status = card.seasonEnded ?? card.seriesStatus
  // Streak, then either Last 10 or the home/road splits — never all three:
  // Last 10 already summarises recent form, so the splits would be redundant.
  const form = [
    card.streak,
    card.last10
      ? `Last 10: ${card.last10}`
      : [card.home && `Home ${card.home}`, card.road && `Road ${card.road}`]
          .filter(Boolean)
          .join(' · '),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div data-testid="team-card" style={{ paddingBottom: 8, borderBottom: '1px solid var(--ink)' }}>
      <div className="flex items-baseline justify-between" style={{ gap: 8 }}>
        <Kicker>
          {column.league} · {column.team}
        </Kicker>
        <span style={monoMuted}>{column.phaseDetail}</span>
      </div>

      {phase === 'postseason' && status && (
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 700,
            lineHeight: 1.15,
            margin: '6px 0 4px',
          }}
        >
          {status}
        </div>
      )}

      {phase === 'regular' && card.record && (
        <div className="flex items-baseline" style={{ gap: 10, margin: '4px 0 2px' }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 34,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {card.record}
          </span>
          {card.standing && (
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: 15,
                color: 'var(--ink-muted)',
              }}
            >
              {card.standing}
            </span>
          )}
        </div>
      )}

      {phase === 'regular' && form && (
        <div
          style={{
            ...monoMuted,
            letterSpacing: '0.06em',
            color: 'var(--ink)',
            margin: '4px 0 6px',
          }}
        >
          {form}
        </div>
      )}

      {!compact && card.last && (
        <div style={gameLine}>
          <span style={monoMuted}>LAST</span>
          <span>
            <b>{card.last.result}</b> {card.last.score} {vs(card.last.homeAway, card.last.opponent)}{' '}
            · {formatFinalDate(card.last.startsAt)}
          </span>
        </div>
      )}

      {card.next && (
        <div style={gameLine}>
          <span style={monoMuted}>NEXT</span>
          <span>
            {card.next.label && `${card.next.label} · `}
            {vs(card.next.homeAway, card.next.opponent)} · {formatUpcomingTime(card.next.startsAt)}
            {card.next.tv && ` · ${card.next.tv}`}
          </span>
        </div>
      )}
    </div>
  )
}

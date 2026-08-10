import { formatFinalDate, useSportsFinalRecap } from '@/integrations/sports'
import type { Game } from '@/integrations/sports'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'

/** One team in the score line. The winner carries full ink and weight and the
 *  loser recedes, so the result reads from across the kitchen without anyone
 *  having to compare two numbers. */
function Side({ team, side }: { team: Game['home']; side: 'home' | 'away' }) {
  return (
    <span
      data-testid={`final-side-${side}`}
      style={{
        color: team.winner ? 'var(--ink)' : 'var(--ink-muted)',
        fontWeight: team.winner ? 600 : 400,
      }}
    >
      {team.abbreviation} {team.score ?? '—'}
    </span>
  )
}

/**
 * The last completed game, as one compact ruled strip: when it was, how it
 * ended, and a sentence on how it went.
 *
 * Deliberately the same strip whether it leads the column or sits beneath a
 * pregame block. A second, fuller layout for the leading case was considered
 * and dropped — twice the surface for the same information.
 *
 * The score line renders in every recap state, so a slow or broken LLM never
 * costs you the actual result.
 */
export function FinalReport({ game }: { game: Game }) {
  const { data, isLoading, error } = useSportsFinalRecap(game.id)

  // Three states, not two. An empty summary on a settled query is a failure,
  // not a pending one: treating it as pending would leave "Generating recap…"
  // on the wall indefinitely, with nothing further coming to replace it.
  // Saying nothing at all — which the grid theme does here — is worse still;
  // see this file's test for why an invisible failure is the one to avoid.
  const recap = isLoading
    ? 'Generating recap…'
    : error || !data?.summary
      ? 'Recap unavailable.'
      : data.summary

  return (
    <div className="pt-2.5 mt-4" style={{ borderTop: '1px solid var(--rule)' }}>
      <Kicker color="var(--ink-muted)">Final · {formatFinalDate(game.startTime)}</Kicker>
      <div
        className="mt-1.5"
        style={{ fontFamily: 'var(--font-display)', fontSize: 17, letterSpacing: '-0.01em' }}
      >
        <Side team={game.away} side="away" />
        <span style={{ color: 'var(--rule)' }}> · </span>
        <Side team={game.home} side="home" />
      </div>
      <p
        className="m-0 mt-1.5"
        style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: 13,
          color: 'var(--ink-muted)',
          lineHeight: 1.5,
        }}
      >
        {recap}
      </p>
    </div>
  )
}

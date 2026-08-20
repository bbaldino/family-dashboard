export interface StandfirstInput {
  /** Events still to come today. */
  eventCount: number
  /** Title of the next event today, if any. */
  nextEventTitle: string | null
  sportsState: 'live' | 'pregame' | 'none'
}

function scheduleClause({ eventCount, nextEventTitle }: StandfirstInput): string {
  if (eventCount === 0) return 'Nothing on the calendar — the day is yours'
  if (eventCount === 1 && nextEventTitle) return `One thing today: ${nextEventTitle}`
  if (nextEventTitle) return `${eventCount} things today, starting with ${nextEventTitle}`
  if (eventCount === 1) return '1 thing on the calendar today'
  return `${eventCount} things on the calendar today`
}

function sportsClause(state: StandfirstInput['sportsState']): string | null {
  if (state === 'live') return 'the game is underway'
  if (state === 'pregame') return 'first pitch is later'
  return null
}

/**
 * One dry declarative sentence summarising the day, in the voice of a
 * newspaper standfirst. Deterministic: the wall display re-renders
 * constantly and prose that reshuffles reads as a bug.
 */
export function buildStandfirst(input: StandfirstInput): string {
  const clauses = [scheduleClause(input)]

  const sports = sportsClause(input.sportsState)
  if (sports) clauses.push(sports)

  const sentence =
    clauses.length === 1
      ? clauses[0]
      : `${clauses.slice(0, -1).join(', ')}, and ${clauses[clauses.length - 1]}`

  return `${sentence}.`
}

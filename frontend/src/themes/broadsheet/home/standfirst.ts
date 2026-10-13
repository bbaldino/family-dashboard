import { sportWording } from './sport-wording'

export type StandfirstSports = { state: 'live' | 'pregame'; league: string } | { state: 'none' }

export interface StandfirstInput {
  /** Events still to come today. */
  eventCount: number
  /** Title of the next event today, if any. */
  nextEventTitle: string | null
  sports: StandfirstSports
}

function scheduleClause({ eventCount, nextEventTitle }: StandfirstInput): string {
  if (eventCount === 0) return 'Nothing on the calendar — the day is yours'
  if (eventCount === 1 && nextEventTitle) return `One thing today: ${nextEventTitle}`
  if (nextEventTitle) return `${eventCount} things today, starting with ${nextEventTitle}`
  if (eventCount === 1) return '1 thing on the calendar today'
  return `${eventCount} things on the calendar today`
}

function sportsClause(sports: StandfirstSports): string | null {
  if (sports.state === 'live') return 'the game is underway'
  if (sports.state === 'pregame') {
    const { start } = sportWording(sports.league)
    return start ? `${start} is later` : 'the game is later'
  }
  return null
}

/**
 * One dry declarative sentence summarising the day, in the voice of a
 * newspaper standfirst. Deterministic: the wall display re-renders
 * constantly and prose that reshuffles reads as a bug.
 */
export function buildStandfirst(input: StandfirstInput): string {
  const clauses = [scheduleClause(input)]

  const sports = sportsClause(input.sports)
  if (sports) clauses.push(sports)

  const sentence =
    clauses.length === 1
      ? clauses[0]
      : `${clauses.slice(0, -1).join(', ')}, and ${clauses[clauses.length - 1]}`

  return `${sentence}.`
}

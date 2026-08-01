export interface DatebookStandfirstInput {
  /** Events counted this month (`MonthTally.eventCount`). */
  eventCount: number
  /** The nearest countdown, if any — `useCountdowns()`'s data is sorted
   *  ascending by `daysUntil`, so callers pass its first item. */
  nearestCountdown: { name: string; daysUntil: number } | null
}

function volumeClause(eventCount: number): string {
  if (eventCount === 0) return 'Nothing on the calendar this month'
  if (eventCount === 1) return '1 thing on the calendar this month'
  return `${eventCount} things on the calendar this month`
}

function countdownClause(countdown: DatebookStandfirstInput['nearestCountdown']): string | null {
  if (!countdown) return null
  if (countdown.daysUntil <= 0) return `${countdown.name} is today`
  if (countdown.daysUntil === 1) return `${countdown.name} is tomorrow`
  return `${countdown.name} sits ${countdown.daysUntil} days out`
}

/**
 * One or two dry, declarative sentences summarising the displayed month, in
 * the voice of a newspaper standfirst — mirrors `buildStandfirst`
 * (`src/themes/broadsheet/home/standfirst.ts`) for Home's daily version.
 * Deterministic: the wall display re-renders constantly, and prose that
 * reshuffles reads as a bug.
 *
 * The mock's hand-written example ("A busy run of practices, two
 * graduations, and a wine walk. The last day of school sits 13 days out.")
 * isn't reproducible — nothing in this codebase classifies "a busy run of
 * practices" from a list of event titles — but its shape is: a volume
 * clause, then a countdown clause naming the nearest thing coming up.
 * `useCountdowns()` supplies exactly that second clause (`name`,
 * `daysUntil`).
 */
export function buildDatebookStandfirst(input: DatebookStandfirstInput): string {
  const sentences = [`${volumeClause(input.eventCount)}.`]
  const countdown = countdownClause(input.nearestCountdown)
  if (countdown) sentences.push(`${countdown}.`)
  return sentences.join(' ')
}

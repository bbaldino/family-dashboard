/**
 * Assembles the day's facts into the plain-text block the caas "From the House"
 * standfirst is generated from (`useHouseStandfirst` → `/api/house/standfirst`).
 *
 * Deliberately COARSE. The backend caches the generated line keyed by a hash of
 * this exact string, so anything that changes it triggers a regeneration — that
 * is how the line refreshes as the day moves (an event passes, the game starts,
 * a new time-of-day). So it must carry only facts that change on a meaningful
 * boundary, never a per-second value: a time-of-day word, not the clock; a game
 * as "on now"/"tonight", never a live score (which would thrash the cache and
 * is already on the wall in the live block). The deterministic `buildStandfirst`
 * remains the fallback whenever the generated line isn't ready.
 */

export type SportsFact =
  | { kind: 'live' }
  | { kind: 'pregame'; away: string; home: string; firstPitch: string }
  | { kind: 'none' }

export interface StandfirstFactsInput {
  now: Date
  /** All-day birthday events today, by raw title — caas phrases the wish. */
  birthdays: string[]
  /** Events still to come today, already time-formatted (birthdays excluded). */
  events: { title: string; time: string }[]
  sports: SportsFact
  weather: { tempF: number; description: string } | null
}

const DAY_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'long' })

function timeOfDay(now: Date): string {
  const h = now.getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  if (h < 21) return 'evening'
  return 'night'
}

function sportsLine(sports: SportsFact): string | null {
  switch (sports.kind) {
    case 'live':
      return 'Baseball: the game is on now'
    case 'pregame':
      return `Baseball: ${sports.away} at ${sports.home}, first pitch ${sports.firstPitch}`
    case 'none':
      return null
  }
}

export function buildStandfirstFacts(input: StandfirstFactsInput): string {
  const lines: string[] = [`- ${DAY_FORMAT.format(input.now)} ${timeOfDay(input.now)}`]

  if (input.birthdays.length > 0) {
    lines.push(`- Birthdays today: ${input.birthdays.join(', ')}`)
  }

  lines.push(
    input.events.length > 0
      ? `- Calendar, still to come: ${input.events.map((e) => `${e.title} (${e.time})`).join(', ')}`
      : `- Calendar: nothing still to come today`,
  )

  const sports = sportsLine(input.sports)
  if (sports) lines.push(`- ${sports}`)
  if (input.weather) lines.push(`- Weather: ${input.weather.tempF}°F, ${input.weather.description}`)

  return lines.join('\n')
}

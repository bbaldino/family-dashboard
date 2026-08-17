import { useQuery } from '@tanstack/react-query'
import { activeScenario } from '@/lib/scenario'
import { sportsIntegration } from './config'
import { sportsSectionFixtureFor } from './section-fixtures'
import type { SportsSection } from './section-types'

/**
 * The aggregated Sports section — "The Sporting Page".
 *
 * Scenario-aware, like the media hooks: `?scenario=sports-summer` or
 * `sports-autumn` returns a fixture and makes no request; otherwise it fetches
 * the backend's aggregated `/sports/section`. That endpoint is stage 2 — this
 * hook and the whole screen are built and verified against fixtures first, the
 * same fixtures-first path the media theme took.
 *
 * Cached for a good while: the section aggregates news, standings, scores and
 * season leaders, none of which move on a live-game cadence, and the leaders
 * portion is expensive enough that the backend resolves it on a schedule.
 */
export function useSportsSection() {
  const fixture = sportsSectionFixtureFor(activeScenario)
  return useQuery({
    queryKey: ['sports', 'section'],
    queryFn: () =>
      fixture ? Promise.resolve(fixture) : sportsIntegration.api.get<SportsSection>('/section'),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
  })
}

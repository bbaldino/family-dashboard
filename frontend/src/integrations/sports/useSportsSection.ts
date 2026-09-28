import { useQuery } from '@tanstack/react-query'
import { activeScenario } from '@/lib/scenario'
import { sportsIntegration } from './config'
import { sportsSectionFixtureFor } from './section-fixtures'
import type { SportsSection } from './section-types'

/**
 * The aggregated Sports section — "The Sporting Page".
 *
 * Scenario-aware, like the media hooks: `?scenario=sports-summer`,
 * `sports-autumn`, `sports-postseason` or `sports-eliminated` returns a fixture
 * and makes no request (see `section-fixtures.ts` for what each one exercises);
 * otherwise it fetches the backend's aggregated `/sports/section`.
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

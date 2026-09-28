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
 * Refetched every 15 minutes. Most of the section — news, standings, season
 * leaders, the postseason field — moves slowly, and the leaders portion is
 * expensive to resolve. The league slate does carry live games, so a live
 * score here can trail the real one by up to that interval; the live-game
 * panel on Home is where scores update in real time.
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

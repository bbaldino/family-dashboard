import { useQuery } from '@tanstack/react-query'
import { activeScenario } from '@/lib/scenario'
import { musicIntegration } from './config'
import { parseSearchResponse } from './search'
import { musicSearchFixtureFor } from './fixtures'
import type { SearchResults } from './types'

/** Searches Music Assistant for `query` and normalizes the response into
 *  per-media-type buckets. Only enabled once `query` is at least 2
 *  characters — callers debounce `query` themselves. */
export function useSearch(query: string) {
  return useQuery<SearchResults>({
    queryKey: ['music', 'search', query],
    queryFn: async () => {
      const fixture = musicSearchFixtureFor(activeScenario)
      if (fixture) return fixture
      const raw = await musicIntegration.api.get<unknown>(`/search?q=${encodeURIComponent(query)}`)
      return parseSearchResponse(raw)
    },
    enabled: query.length >= 2,
  })
}

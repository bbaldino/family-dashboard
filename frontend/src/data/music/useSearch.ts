import { useQuery } from '@tanstack/react-query'
import { musicIntegration } from './config'
import { parseSearchResponse } from './search'
import type { SearchResults } from './types'

/** Searches Music Assistant for `query` and normalizes the response into
 *  per-media-type buckets. Only enabled once `query` is at least 2
 *  characters — callers debounce `query` themselves. */
export function useSearch(query: string) {
  return useQuery<SearchResults>({
    queryKey: ['music', 'search', query],
    queryFn: async () => {
      const raw = await musicIntegration.api.get<unknown>(`/search?q=${encodeURIComponent(query)}`)
      return parseSearchResponse(raw)
    },
    enabled: query.length >= 2,
  })
}

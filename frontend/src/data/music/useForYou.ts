import { useQuery } from '@tanstack/react-query'
import { activeScenario } from '@/data/scenario'
import { musicIntegration } from './config'
import { parseSearchResponse } from './search'
import { musicForYouFixtureFor } from './fixtures'

export interface CuratedPlaylist {
  name: string
  description: string
  uri: string
  image?: { path: string } | string | null
}

// Well-known Spotify playlist names that are stable per-account
const CURATED_PLAYLISTS = [
  { name: 'Discover Weekly', query: 'Discover Weekly' },
  { name: 'Release Radar', query: 'Release Radar' },
  { name: 'Daily Mix 1', query: 'Daily Mix 1' },
  { name: 'Daily Mix 2', query: 'Daily Mix 2' },
  { name: 'Daily Mix 3', query: 'Daily Mix 3' },
  { name: 'Daily Mix 4', query: 'Daily Mix 4' },
]

async function fetchCuratedPlaylists(): Promise<CuratedPlaylist[]> {
  const results: CuratedPlaylist[] = []

  for (const { name, query } of CURATED_PLAYLISTS) {
    try {
      const data = await musicIntegration.api.get<unknown>(`/search?q=${encodeURIComponent(query)}`)
      const { playlists } = parseSearchResponse(data)
      if (playlists.length > 0) {
        // Find the best match — exact name match preferred
        const match =
          playlists.find((p) => p.name.toLowerCase() === name.toLowerCase()) ?? playlists[0]
        results.push({
          name: match.name || name,
          description: name,
          uri: match.uri,
          image: match.image ?? null,
        })
      }
    } catch {
      // Skip failed searches
    }
  }

  return results
}

export function useForYou() {
  return useQuery({
    queryKey: ['music', 'for-you'],
    queryFn: () => {
      const fixture = musicForYouFixtureFor(activeScenario)
      return fixture ? Promise.resolve(fixture) : fetchCuratedPlaylists()
    },
    refetchInterval: 30 * 60 * 1000, // refresh every 30 min
    staleTime: 10 * 60 * 1000,
  })
}

import { useQuery } from '@tanstack/react-query'
import { activeScenario } from '@/lib/scenario'
import { musicIntegration } from './config'
import {
  musicTopTracksFixtureFor,
  musicRecentFixtureFor,
  musicPlaylistsFixtureFor,
} from './fixtures'
import type { TopTrack, RecentItem, Playlist } from './types'

/** The "Frequently Played" list backing the quick-dials screen. */
export function useTopTracks() {
  return useQuery({
    queryKey: ['music', 'top-tracks'],
    queryFn: () => {
      const fixture = musicTopTracksFixtureFor(activeScenario)
      return fixture
        ? Promise.resolve(fixture)
        : musicIntegration.api.get<TopTrack[]>('/top-tracks?limit=12')
    },
    refetchInterval: 5 * 60 * 1000,
  })
}

/** The "Recently Played" list backing the quick-dials screen. */
export function useRecentlyPlayed() {
  return useQuery({
    queryKey: ['music', 'recent'],
    queryFn: () => {
      const fixture = musicRecentFixtureFor(activeScenario)
      return fixture ? Promise.resolve(fixture) : musicIntegration.api.get<RecentItem[]>('/recent')
    },
    refetchInterval: 5 * 60 * 1000,
  })
}

/** The library playlists backing the Media page's Playlists shelf. Refetched
 *  slowly: a household's playlist set barely changes within a session. */
export function usePlaylists() {
  return useQuery({
    queryKey: ['music', 'playlists'],
    queryFn: () => {
      const fixture = musicPlaylistsFixtureFor(activeScenario)
      return fixture ? Promise.resolve(fixture) : musicIntegration.api.get<Playlist[]>('/playlists')
    },
    refetchInterval: 10 * 60 * 1000,
  })
}

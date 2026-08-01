import { useQuery } from '@tanstack/react-query'
import { activeScenario } from '@/data/scenario'
import { musicIntegration } from './config'
import { musicPlayersFixtureFor } from './fixtures'
import type { Player } from './types'

/** Raw shape returned by MA via the `/players` proxy (snake_case fields). */
export interface RawPlayer {
  player_id?: string
  display_name?: string
  name?: string
  state?: string
  available?: boolean
  volume_level?: number | null
  group_members?: string[] | null
  synced_to?: string | null
  can_group_with?: string[] | null
  group_volume?: number | null
}

export function normalizePlayer(raw: RawPlayer): Player {
  return {
    playerId: raw.player_id ?? '',
    displayName: raw.display_name ?? raw.name ?? raw.player_id ?? '',
    state: raw.state ?? 'idle',
    available: raw.available ?? true,
    volumeLevel: raw.volume_level ?? null,
    groupMembers: raw.group_members ?? [],
    syncedTo: raw.synced_to ?? null,
    canGroupWith: raw.can_group_with ?? [],
    groupVolume: raw.group_volume ?? null,
  }
}

interface UsePlayersOptions {
  /** Only fetch/poll while the player picker is open. */
  isOpen: boolean
  /** Suppress the poll during a group/ungroup mutation's optimistic window. */
  pollingPaused: boolean
}

/** Fetches the raw `/players` list. Kept raw (not `normalizePlayer`d) because
 *  the player picker's group/ungroup optimistic updates mutate the query
 *  cache directly in this pre-normalized shape. */
export function usePlayers({ isOpen, pollingPaused }: UsePlayersOptions) {
  return useQuery({
    queryKey: ['music', 'players'],
    queryFn: () => {
      const fixture = musicPlayersFixtureFor(activeScenario)
      return fixture ? Promise.resolve(fixture) : musicIntegration.api.get<RawPlayer[]>('/players')
    },
    enabled: isOpen,
    refetchInterval: isOpen && !pollingPaused ? 5_000 : false,
    refetchOnWindowFocus: false,
  })
}

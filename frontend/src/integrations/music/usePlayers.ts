import { useQuery } from '@tanstack/react-query'
import { activeScenario } from '@/lib/scenario'
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

/** The single `/players` cache entry. Every consumer — the picker's poll,
 *  the settings list, and `useGroupMutations`' optimistic writes — keys off
 *  this one constant, so a change here can't leave two of them reading
 *  different caches of the same endpoint. */
export const PLAYERS_QUERY_KEY = ['music', 'players']

/** The one `/players` fetch, shared by both hooks below. Scenario fixtures
 *  short-circuit it here so neither hook has to know about them. */
function fetchPlayers(): Promise<RawPlayer[]> {
  const fixture = musicPlayersFixtureFor(activeScenario)
  return fixture ? Promise.resolve(fixture) : musicIntegration.api.get<RawPlayer[]>('/players')
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
    queryKey: PLAYERS_QUERY_KEY,
    queryFn: fetchPlayers,
    enabled: isOpen,
    refetchInterval: isOpen && !pollingPaused ? 5_000 : false,
    refetchOnWindowFocus: false,
  })
}

/**
 * The same `/players` list as options for admin's default-player picker:
 * fetched on demand (a "Load Players" button, so opening the settings page
 * never dials Music Assistant on its own), never polled, and normalized to
 * camelCase `Player`s — settings only reads names and ids, and has no
 * optimistic cache writes to keep in the raw wire shape.
 *
 * Named for the *use*, not the shape: `usePlayers` and a `usePlayerList`
 * would read as the same thing, and nothing in either name would tell you
 * which to reach for. Pick this one when you want something to choose from;
 * pick `usePlayers` when you want live player state.
 *
 * Deliberately a second hook over the *same* query rather than options on
 * `usePlayers`: the two callers differ only in `enabled`/`refetchInterval`,
 * and react-query resolves that per observer. Sharing `PLAYERS_QUERY_KEY`
 * and `fetchPlayers` is what matters — one endpoint, one cache entry, one
 * `normalizePlayer` — while each caller keeps its own fetch policy.
 */
export function usePlayerOptions() {
  return useQuery({
    queryKey: PLAYERS_QUERY_KEY,
    queryFn: fetchPlayers,
    enabled: false,
    // `Array.isArray` guard: the settings screen is the one place a
    // misconfigured URL/token can put a non-list body in front of this hook,
    // and it treated that as "no players" long before it was a query.
    select: (raw: RawPlayer[]) => (Array.isArray(raw) ? raw : []).map(normalizePlayer),
  })
}

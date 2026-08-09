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

/** Shared by the two normalizing hooks below. The `Array.isArray` guard is
 *  there because a misconfigured URL/token can put a non-list body in front
 *  of them, which both treat as "no players". */
const toPlayers = (raw: RawPlayer[]) => (Array.isArray(raw) ? raw : []).map(normalizePlayer)

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
 * fetched on demand (a "Load Players" button) and never polled itself, so
 * *this hook* never dials Music Assistant on its own. That no longer means
 * opening the settings page is guaranteed to find an empty cache, though —
 * `useGroupTopology` below shares the same `PLAYERS_QUERY_KEY` and fetches
 * once on mount, so by the time settings opens the cache may already be
 * populated from the app's own boot-time fetch. Normalized to camelCase
 * `Player`s — settings only reads names and ids, and has no optimistic cache
 * writes to keep in the raw wire shape.
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
    select: toPlayers,
  })
}

/**
 * The same `/players` list as *group topology* for `MusicProvider`: who is
 * synced to whom, so the provider can resolve the anchor's group leader and
 * show that leader's queue (`anchor.ts`). Normalized like
 * `usePlayerOptions`, since the provider only reads ids and names.
 *
 * The third hook over this one query — see `usePlayerOptions`' comment on
 * why that's a fetch policy per caller rather than options on one hook —
 * and the one that must **not** poll. `MusicProvider` is mounted for the
 * life of the app, so a poll here would be a `/players` request every few
 * seconds forever, and worse, it would land inside the window
 * `useGroupMutations` protects: that hook writes group membership
 * optimistically and then waits up to 15s for MA to converge, with
 * `usePlayers`' own poll paused throughout. An independent poll from the
 * provider would ignore that pause and overwrite a correct optimistic write
 * with MA's stale pre-mutation state — the exact sequence that made a room
 * pill flip back and the next tap send the wrong command (see
 * `useGroupMutations.ts`'s header).
 *
 * So this observer only ever reads the shared cache: it fetches once on
 * mount and is then kept in step by whatever else is already writing that
 * cache — the room pills' 5s poll while the Media screen is up,
 * `PlayerPicker`'s while it's open, and every group mutation's optimistic
 * write plus its reconciling invalidation. The gap that leaves is grouping
 * changed from *another* app (the Sonos app, say) while the panel is on a
 * screen that mounts neither: the topology then stays as it was until one
 * of them mounts again.
 */
export function useGroupTopology(enabled: boolean) {
  return useQuery({
    queryKey: PLAYERS_QUERY_KEY,
    queryFn: fetchPlayers,
    enabled,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    select: toPlayers,
  })
}

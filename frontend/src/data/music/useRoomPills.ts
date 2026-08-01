import { useIntegrationConfig } from '@/data/use-integration-config'
import { activeScenario } from '@/data/scenario'
import { musicIntegration } from './config'
import { usePlayers, normalizePlayer } from './usePlayers'
import { useGroupMutations } from './useGroupMutations'
import { musicAnchorFixtureFor } from './fixtures'
import type { Player } from './types'

/**
 * Backs broadsheet's room pills (`RoomPill.tsx`, hosted by `MediaMasthead`
 * and `CentreSpreadCredits`). Both hosts call this one hook rather than
 * each wiring config/players/mutations themselves — the design brief is
 * explicit that the two screens' pill behaviour must not be allowed to
 * drift, and a single shared hook makes that true by construction instead
 * of by convention.
 *
 * The **anchor** is the kitchen panel's own room — `music.default_player`
 * from config, not hardcoded and not assumed to be named "Kitchen" (see the
 * room-grouping brief). It's always shown active and is never itself
 * tappable. Every other pill is a join/leave toggle against it, filtered to
 * the anchor's own `can_group_with` — a room MA reports as incompatible
 * (e.g. a Chromecast display) is never offered, rather than offered and
 * silently failing.
 *
 * Under an active `?scenario=`, the anchor comes from `musicAnchorFixtureFor`
 * instead of that config fetch. `useIntegrationConfig` always hits the real,
 * live `/api/config` — the scenario mechanism only short-circuits the music
 * *hooks*, not that fetch — so under a scenario it would keep reporting the
 * household's real Sonos id, which no `fixture-*` player id in
 * `fixtures.ts` can ever match. Left unhandled, that mismatch makes
 * `resolveAnchorAndRooms` correctly (but uselessly) resolve to no anchor,
 * and the fixtures become unable to exercise the pills at all — a real
 * defect this hook shipped with once, caught by loading a scenario in an
 * actual browser rather than trusting mocked-id unit tests. With no
 * scenario active, `musicAnchorFixtureFor` returns `undefined` and the
 * config value is used exactly as before.
 *
 * Reuses the same `useGroupMutations` PlayerPicker calls (see that hook's
 * own header comment on the lift) — a joining room adopts whatever the
 * anchor is playing, same as grid's "Add" button, just entered from a pill
 * tap instead of the picker modal. Also reuses `usePlayers`'s
 * `pollingPaused` gate for the same reason PlayerPicker needs it: without
 * it, a 5s poll landing mid-mutation could clobber the optimistic pill
 * state with stale data.
 */
export interface RoomPillView {
  player: Player
  /** The anchor's own pill — always shown filled, never tappable. */
  isAnchor: boolean
  /** Filled state: true for the anchor itself, true for a room currently
   *  grouped with it. */
  joined: boolean
  /** A group/ungroup call for this room is in flight. */
  pending: boolean
}

export interface RoomPillsState {
  /** Anchor first, then every room it can group with — `[]` when there's no
   *  configured anchor, no players yet, or the configured anchor isn't in
   *  the current players list (all ordinary cold-cache states, not errors). */
  pills: RoomPillView[]
  /** Join/leave `playerId` against the anchor. No-op for the anchor's own
   *  id, an id not among the current pills, or one already mid-mutation. */
  toggle: (playerId: string) => void
}

/** Whether `player` currently reads as grouped with `anchor`. The anchor's
 *  own `groupMembers` is the reliable signal — MA doesn't consistently
 *  populate a follower's `synced_to` (see `useGroupMutations.ts` /
 *  PlayerPicker's own comment on this) — but checking `syncedTo` too costs
 *  nothing and covers a moment `groupMembers` hasn't caught up on this
 *  player specifically. */
export function isJoinedToAnchor(anchor: Player, player: Player): boolean {
  return anchor.groupMembers.includes(player.playerId) || player.syncedTo === anchor.playerId
}

/** Pure: resolves the configured anchor and the rooms it can group with out
 *  of a normalized players list. Exported so the resolution logic can be
 *  tested directly against fixture data, without mounting the hook's
 *  query/config/mutation machinery. */
export function resolveAnchorAndRooms(
  players: Player[],
  anchorId: string | null | undefined,
): { anchor: Player | null; rooms: Player[] } {
  if (!anchorId) return { anchor: null, rooms: [] }
  const anchor = players.find((p) => p.playerId === anchorId) ?? null
  if (!anchor) return { anchor: null, rooms: [] }
  const groupable = new Set(anchor.canGroupWith)
  const rooms = players.filter((p) => p.playerId !== anchor.playerId && groupable.has(p.playerId))
  return { anchor, rooms }
}

export function useRoomPills(): RoomPillsState {
  const config = useIntegrationConfig(musicIntegration)
  const fixtureAnchorId = musicAnchorFixtureFor(activeScenario)
  const anchorId = fixtureAnchorId !== undefined ? fixtureAnchorId : (config?.default_player ?? null)

  const { pendingIds, pollingPaused, addToGroup, removeFromGroup } = useGroupMutations()
  const { data: rawPlayers } = usePlayers({ isOpen: true, pollingPaused })
  const players = (rawPlayers ?? []).map(normalizePlayer)

  const { anchor, rooms } = resolveAnchorAndRooms(players, anchorId)

  const pills: RoomPillView[] = anchor
    ? [
        { player: anchor, isAnchor: true, joined: true, pending: false },
        ...rooms.map((player) => ({
          player,
          isAnchor: false,
          joined: isJoinedToAnchor(anchor, player),
          pending: pendingIds.has(player.playerId),
        })),
      ]
    : []

  const toggle = (playerId: string) => {
    if (!anchor) return
    const pill = pills.find((p) => p.player.playerId === playerId)
    if (!pill || pill.isAnchor || pill.pending) return
    if (pill.joined) removeFromGroup(playerId, anchor.playerId)
    else addToGroup(playerId, anchor.playerId)
  }

  return { pills, toggle }
}

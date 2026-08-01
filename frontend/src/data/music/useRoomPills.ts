import { useState } from 'react'
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
  pendingIds: ReadonlySet<string> = new Set(),
): { anchor: Player | null; rooms: Player[] } {
  if (!anchorId) return { anchor: null, rooms: [] }
  const anchor = players.find((p) => p.playerId === anchorId) ?? null
  if (!anchor) return { anchor: null, rooms: [] }
  const groupable = new Set(anchor.canGroupWith)
  // `can_group_with` is a moving target: MA recomputes it as grouping changes,
  // and mid-transition it can briefly stop listing a room that is perfectly
  // valid either side of the change. Filtering on capability alone therefore
  // made a pill vanish from the row at the exact moment it was tapped —
  // observed live, and the cause of a report that a room "disappeared from the
  // rooms list completely". Worse, a room that vanished while joined left no
  // way to un-join it.
  //
  // So a room stays listed if it is groupable OR currently joined OR has a
  // mutation in flight. Capability alone decides whether a room is ever
  // offered; it never yanks one out from under an interaction in progress.
  const rooms = players.filter(
    (p) =>
      p.playerId !== anchor.playerId &&
      (groupable.has(p.playerId) || isJoinedToAnchor(anchor, p) || pendingIds.has(p.playerId)),
  )
  return { anchor, rooms }
}

export function useRoomPills(): RoomPillsState {
  const config = useIntegrationConfig(musicIntegration)
  const fixtureAnchorId = musicAnchorFixtureFor(activeScenario)
  const anchorId = fixtureAnchorId !== undefined ? fixtureAnchorId : (config?.default_player ?? null)

  const { pendingIds, pollingPaused, addToGroup, removeFromGroup } = useGroupMutations()
  const { data: rawPlayers } = usePlayers({ isOpen: true, pollingPaused })
  const players = (rawPlayers ?? []).map(normalizePlayer)

  // Rooms this anchor has offered at any point since it was resolved. MA
  // reports a room as neither groupable nor joined for several seconds in the
  // middle of a group/ungroup — observed live, with a pill dropping out of the
  // row for five seconds before reappearing correctly grouped. Widening the
  // filter isn't enough because during that window every signal says "not a
  // room": the list has to remember. A room leaves only when it leaves the
  // players payload entirely, or when the anchor itself changes.
  const [seen, setSeen] = useState<{ anchorId: string | null; ids: string[] }>({
    anchorId: null,
    ids: [],
  })

  const resolved = resolveAnchorAndRooms(players, anchorId, pendingIds)
  const anchor = resolved.anchor

  // Adjust the remembered set during render — React's documented pattern for
  // state derived from changing inputs — rather than in an effect, so the
  // pills below never render one frame with a room missing before an effect
  // puts it back.
  const carried = seen.anchorId === anchorId ? seen.ids : []
  const nextIds = [...new Set([...carried, ...resolved.rooms.map((r) => r.playerId)])]
  if (seen.anchorId !== anchorId || nextIds.length !== seen.ids.length) {
    setSeen({ anchorId: anchorId ?? null, ids: nextIds })
  }

  const sticky = new Set(nextIds)
  const rooms = anchor
    ? players.filter((p) => p.playerId !== anchor.playerId && sticky.has(p.playerId))
    : resolved.rooms

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

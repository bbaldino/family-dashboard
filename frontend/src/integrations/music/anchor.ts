import type { Player, QueueState } from './types'

/**
 * The **anchor** is the panel's own room — `music.default_player` from
 * config (see `useAnchorId`), not hardcoded and not assumed to be named
 * "Kitchen". Everything here answers the two questions a wall panel has
 * about it: *which queue is this room hearing*, and *what do we call the
 * room*.
 *
 * Pure and hook-free on purpose: `MusicProvider` derives the active queue
 * from it on every render, `useRoomPills` shares its membership predicate,
 * and both are testable against a plain players list with no query client,
 * config fetch or component in the way.
 */

/**
 * Whether `member` currently reads as grouped under `leader`.
 *
 * Membership has to be read from *both* directions. The leader's own
 * `group_members` is the reliable signal, but Music Assistant doesn't
 * consistently populate a follower's `synced_to` — and the reverse gap is
 * real too, with `group_members` briefly behind on a player that has
 * already reported itself synced. `useGroupMutations.ts`'s membership
 * comment records what that cost: an optimistic write that moved only one
 * of the two made a *removal* still read as joined.
 *
 * Deliberately symmetric in its arguments' roles rather than phrased around
 * the anchor, because it's used in both directions: `isGroupedUnder(anchor,
 * room)` asks whether a room has joined the anchor (the room pills), and
 * `isGroupedUnder(candidate, anchor)` asks whether the anchor has joined
 * some other player (the leader lookup below).
 */
export function isGroupedUnder(leader: Player, member: Player): boolean {
  return leader.groupMembers.includes(member.playerId) || member.syncedTo === leader.playerId
}

export interface AnchorGroup {
  /** The configured anchor, or `null` when unconfigured or not in the list. */
  anchor: Player | null
  /** Who owns the group's queue: another player when the anchor is a
   *  follower, otherwise the anchor itself. `null` only when there's no
   *  anchor at all. */
  leader: Player | null
  /** The whole group as display order: the anchor first, then every other
   *  room in it (the leader included when that isn't the anchor). Empty
   *  when there's no anchor. */
  members: Player[]
}

/**
 * Resolves the anchor's group out of a normalized players list.
 *
 * The leader matters because a grouped follower has no active queue of its
 * own: when players group, one is the coordinator and owns the queue. So
 * "show the anchor's queue" is the trap — it would blank the screen while
 * the anchor is audibly playing as part of someone else's group. Resolving
 * the leader first covers every case with no branching: alone, leading, or
 * following.
 */
export function resolveAnchorGroup(
  players: Player[],
  anchorId: string | null | undefined,
): AnchorGroup {
  if (!anchorId) return { anchor: null, leader: null, members: [] }
  const anchor = players.find((p) => p.playerId === anchorId) ?? null
  if (!anchor) return { anchor: null, leader: null, members: [] }

  // Whoever the anchor is synced to, or whoever lists the anchor as one of
  // theirs — see `isGroupedUnder` on why both, and never just `syncedTo`.
  // Falling back to the anchor covers the ordinary ungrouped case and a
  // `synced_to` naming a player that isn't in the list.
  const leader =
    players.find((p) => p.playerId !== anchor.playerId && isGroupedUnder(p, anchor)) ?? anchor

  // The anchor is prepended rather than filtered in, which is also what
  // dedupes it: MA's leader-reported `group_members` includes the leader's
  // own id, so a leader that *is* the anchor would otherwise appear twice.
  //
  // The leader itself is added explicitly rather than relying on that same
  // self-listing convention: MA has always been observed to include the
  // leader's own id in its own `group_members` (see `fixtures.ts`'s
  // `packedPlayers` comment), but a leader that ever omitted itself would
  // otherwise silently drop out of the label — reading "The Kitchen" while
  // the Deck's queue was playing, instead of "The Kitchen and Deck".
  const members = [
    anchor,
    ...(leader.playerId === anchor.playerId ? [] : [leader]),
    ...players.filter(
      (p) =>
        p.playerId !== anchor.playerId &&
        p.playerId !== leader.playerId &&
        isGroupedUnder(leader, p),
    ),
  ]
  return { anchor, leader, members }
}

/**
 * The group as a room label, read as prose rather than punctuation:
 * `Kitchen`, `Kitchen and Deck`, `Kitchen, Deck and Patio`. Callers supply
 * their own article — the mastheads render `Now playing in the {label}`.
 *
 * No serial comma before the final `and`: this sits under a broadsheet
 * masthead, and newspaper style omits it.
 *
 * The anchor is always first (`resolveAnchorGroup` puts it there), so the
 * room you are standing in leads the sentence however the group is led.
 *
 * `null` for an empty group — every state where there is no anchor to name.
 */
export function anchorGroupLabel(members: Player[]): string | null {
  const names = members.map((m) => m.displayName)
  if (names.length === 0) return null
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** The old, roomless derivation: the first queue that's playing, else the
 *  first paused, else the first idle one that still has a track. Still the
 *  right answer when no anchor is configured — there's no room to anchor to,
 *  so whatever is playing is all there is to show. */
function firstActiveQueueAnywhere(queues: QueueState[]): QueueState | null {
  const active =
    queues.find((q) => q.state === 'playing') ?? queues.find((q) => q.state === 'paused')
  if (active) return active
  return queues.find((q) => q.state === 'idle' && q.currentItem != null) ?? null
}

/**
 * The queue the panel should show: the one belonging to the anchor's group
 * leader, or `null` when that room is silent.
 *
 * This is the fix for a Media screen that read "Now playing in the Deck" on
 * a Kitchen-anchored panel. The label was accurate — the queue really was
 * the Deck's — because the derivation took the first playing (else paused)
 * queue *anywhere in the house*, and only used the anchor to break ties
 * among idle ones. A kitchen wall panel showed a queue nobody in the
 * kitchen could hear. Silence is the honest answer there, and the empty
 * state already exists (`NowSpinning`'s "Nothing on the platter.").
 */
export function deriveActiveQueue(
  queues: QueueState[],
  players: Player[],
  anchorId: string | null | undefined,
): QueueState | null {
  if (!anchorId) return firstActiveQueueAnywhere(queues)

  // Before the players list has loaded there's no group to resolve, but the
  // anchor is still the only room worth showing — never fall back to
  // whatever else is playing, which is the bug being fixed.
  const { leader } = resolveAnchorGroup(players, anchorId)
  const leaderId = leader?.playerId ?? anchorId

  const queue = queues.find((q) => q.queueId === leaderId) ?? null
  if (!queue) return null
  // An idle queue with no track left on it is silence, not a thing to show
  // — same distinction the roomless derivation above has always made.
  if (queue.state === 'idle' && queue.currentItem == null) return null
  return queue
}

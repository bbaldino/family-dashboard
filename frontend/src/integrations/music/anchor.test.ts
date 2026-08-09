import { describe, expect, it } from 'vitest'
import { anchorGroupLabel, deriveActiveQueue, isGroupedUnder, resolveAnchorGroup } from './anchor'
import type { Player, QueueState, TrackInfo } from './types'

const KITCHEN = 'kitchen'
const DECK = 'deck'
const PATIO = 'patio'

function player(playerId: string, displayName: string, over: Partial<Player> = {}): Player {
  return {
    playerId,
    displayName,
    state: 'idle',
    available: true,
    volumeLevel: 50,
    groupMembers: [],
    syncedTo: null,
    canGroupWith: [],
    groupVolume: null,
    ...over,
  }
}

const track: TrackInfo = {
  name: 'Amber Hours',
  artist: 'The Night Shift',
  album: 'Late Bloom',
  imageUrl: null,
  duration: 238,
  elapsed: 71,
  uri: 'fixture://track/amber-hours',
}

function queue(
  queueId: string,
  displayName: string,
  state: QueueState['state'],
  currentItem: TrackInfo | null = track,
): QueueState {
  return { queueId, displayName, state, currentItem, volumeLevel: 40 }
}

// The kitchen alone: MA reports an ungrouped player with an empty
// `group_members` and no `synced_to`.
const kitchenAlone = player(KITCHEN, 'Kitchen')
// The kitchen leading a group. MA's leader-reported list includes the
// leader's own id (see `fixtures.ts`'s `packedPlayers` comment), which is
// why the label below has to dedupe rather than assume.
const kitchenLeading = player(KITCHEN, 'Kitchen', { groupMembers: [KITCHEN, PATIO] })
const patioFollowing = player(PATIO, 'Patio', { syncedTo: KITCHEN })

describe('isGroupedUnder', () => {
  it('reads the leader’s own group_members', () => {
    expect(isGroupedUnder(kitchenLeading, player(PATIO, 'Patio'))).toBe(true)
  })

  it('reads a follower’s synced_to even when the leader’s list has not caught up', () => {
    expect(isGroupedUnder(player(KITCHEN, 'Kitchen'), patioFollowing)).toBe(true)
  })

  it('is false for an unrelated player', () => {
    expect(isGroupedUnder(kitchenLeading, player(DECK, 'Deck'))).toBe(false)
  })
})

describe('resolveAnchorGroup', () => {
  it('resolves nothing without a configured anchor id', () => {
    expect(resolveAnchorGroup([kitchenAlone], null)).toEqual({
      anchor: null,
      leader: null,
      members: [],
    })
  })

  it('resolves nothing when the configured anchor is not in the players list', () => {
    expect(resolveAnchorGroup([player(DECK, 'Deck')], KITCHEN)).toEqual({
      anchor: null,
      leader: null,
      members: [],
    })
  })

  it('makes an ungrouped anchor its own leader, alone in its group', () => {
    const { anchor, leader, members } = resolveAnchorGroup([kitchenAlone], KITCHEN)
    expect(anchor?.playerId).toBe(KITCHEN)
    expect(leader?.playerId).toBe(KITCHEN)
    expect(members.map((m) => m.playerId)).toEqual([KITCHEN])
  })

  it('keeps the anchor as leader when the anchor leads the group, and lists its followers', () => {
    const players = [kitchenLeading, patioFollowing]
    const { leader, members } = resolveAnchorGroup(players, KITCHEN)
    expect(leader?.playerId).toBe(KITCHEN)
    expect(members.map((m) => m.playerId)).toEqual([KITCHEN, PATIO])
  })

  it('resolves the leader from the anchor’s own synced_to when the anchor is a follower', () => {
    const deck = player(DECK, 'Deck', { groupMembers: [DECK, KITCHEN] })
    const kitchen = player(KITCHEN, 'Kitchen', { syncedTo: DECK })
    const { leader, members } = resolveAnchorGroup([deck, kitchen], KITCHEN)
    expect(leader?.playerId).toBe(DECK)
    // Anchor first, then the rest of the group — including the leader itself.
    expect(members.map((m) => m.playerId)).toEqual([KITCHEN, DECK])
  })

  // The unreliable-data path: MA frequently leaves `synced_to` null on a
  // follower (see `useGroupMutations.ts`'s membership comment), so the
  // leader has to be findable from the other direction too. Getting this
  // wrong makes the anchor intermittently read as ungrouped.
  it('resolves the leader from another player’s group_members when synced_to is absent', () => {
    const deck = player(DECK, 'Deck', { groupMembers: [DECK, KITCHEN] })
    const kitchen = player(KITCHEN, 'Kitchen', { syncedTo: null })
    const { leader, members } = resolveAnchorGroup([deck, kitchen], KITCHEN)
    expect(leader?.playerId).toBe(DECK)
    expect(members.map((m) => m.playerId)).toEqual([KITCHEN, DECK])
  })

  it('falls back to the anchor when its synced_to names a player that is not in the list', () => {
    const kitchen = player(KITCHEN, 'Kitchen', { syncedTo: 'gone' })
    const { leader, members } = resolveAnchorGroup([kitchen], KITCHEN)
    expect(leader?.playerId).toBe(KITCHEN)
    expect(members.map((m) => m.playerId)).toEqual([KITCHEN])
  })
})

describe('anchorGroupLabel', () => {
  it('is null with no group at all', () => {
    expect(anchorGroupLabel([])).toBeNull()
  })

  it('is the anchor’s own name when it is alone', () => {
    expect(anchorGroupLabel(resolveAnchorGroup([kitchenAlone], KITCHEN).members)).toBe('Kitchen')
  })

  it('names the anchor first, then the other rooms, without repeating either', () => {
    const kitchen = player(KITCHEN, 'Kitchen', { syncedTo: DECK })
    // The leader lists itself in its own `group_members`, as MA really does.
    const deck = player(DECK, 'Deck', { groupMembers: [DECK, KITCHEN, PATIO] })
    const patio = player(PATIO, 'Patio', { syncedTo: DECK })
    const { members } = resolveAnchorGroup([deck, kitchen, patio], KITCHEN)
    expect(anchorGroupLabel(members)).toBe('Kitchen + Deck + Patio')
  })
})

/**
 * The four situations from the plan's table, plus the paths around them.
 * The rule is one line — resolve the anchor's group leader, take that
 * leader's queue — and these pin every row of it.
 */
describe('deriveActiveQueue', () => {
  it('takes the anchor’s own queue when the anchor plays alone', () => {
    const queues = [queue(KITCHEN, 'Kitchen', 'playing'), queue(DECK, 'Deck', 'idle', null)]
    expect(deriveActiveQueue(queues, [kitchenAlone], KITCHEN)?.queueId).toBe(KITCHEN)
  })

  it('takes the anchor’s own queue when the anchor leads a group', () => {
    const queues = [queue(KITCHEN, 'Kitchen', 'playing'), queue(PATIO, 'Patio', 'idle', null)]
    const players = [kitchenLeading, patioFollowing]
    expect(deriveActiveQueue(queues, players, KITCHEN)?.queueId).toBe(KITCHEN)
  })

  it('takes the leader’s queue when the anchor is a follower — that is what the anchor is playing', () => {
    const queues = [queue(DECK, 'Deck', 'playing'), queue(KITCHEN, 'Kitchen', 'idle', null)]
    const players = [
      player(DECK, 'Deck', { groupMembers: [DECK, KITCHEN] }),
      player(KITCHEN, 'Kitchen', { syncedTo: DECK }),
    ]
    expect(deriveActiveQueue(queues, players, KITCHEN)?.queueId).toBe(DECK)
  })

  // Same as above with the signal MA actually gives us most of the time.
  it('takes the leader’s queue when the anchor is a follower with no synced_to', () => {
    const queues = [queue(DECK, 'Deck', 'playing'), queue(KITCHEN, 'Kitchen', 'idle', null)]
    const players = [
      player(DECK, 'Deck', { groupMembers: [DECK, KITCHEN] }),
      player(KITCHEN, 'Kitchen', { syncedTo: null }),
    ]
    expect(deriveActiveQueue(queues, players, KITCHEN)?.queueId).toBe(DECK)
  })

  // The reported bug: a kitchen panel showing the Deck's paused queue,
  // correctly labelled with a room nobody in the kitchen is standing in.
  it('shows nothing when another room is playing on its own and the anchor is idle', () => {
    const queues = [queue(DECK, 'Deck', 'paused'), queue(KITCHEN, 'Kitchen', 'idle', null)]
    const players = [player(DECK, 'Deck'), kitchenAlone]
    expect(deriveActiveQueue(queues, players, KITCHEN)).toBeNull()
  })

  it('keeps the anchor’s idle queue when it still has a track to show', () => {
    const queues = [queue(KITCHEN, 'Kitchen', 'idle')]
    expect(deriveActiveQueue(queues, [kitchenAlone], KITCHEN)?.queueId).toBe(KITCHEN)
  })

  it('shows nothing when the leader has no queue at all', () => {
    expect(deriveActiveQueue([queue(DECK, 'Deck', 'playing')], [kitchenAlone], KITCHEN)).toBeNull()
  })

  // Cold cache: the players list hasn't arrived yet, so there's no group to
  // resolve. The anchor is still the right room to show — never another one.
  it('falls back to the anchor’s own queue before the players list has loaded', () => {
    const queues = [queue(DECK, 'Deck', 'playing'), queue(KITCHEN, 'Kitchen', 'paused')]
    expect(deriveActiveQueue(queues, [], KITCHEN)?.queueId).toBe(KITCHEN)
  })

  // No anchor configured at all — nothing to anchor to, so the old
  // whatever's-playing behaviour is the only thing left.
  it('falls back to the first playing queue anywhere when no anchor is configured', () => {
    const queues = [queue(DECK, 'Deck', 'paused'), queue(PATIO, 'Patio', 'playing')]
    expect(deriveActiveQueue(queues, [], null)?.queueId).toBe(PATIO)
  })

  it('falls back to a paused queue, then an idle one with a track, when no anchor is configured', () => {
    expect(
      deriveActiveQueue([queue(DECK, 'Deck', 'idle'), queue(PATIO, 'Patio', 'paused')], [], null)
        ?.queueId,
    ).toBe(PATIO)
    expect(
      deriveActiveQueue(
        [queue(DECK, 'Deck', 'idle', null), queue(PATIO, 'Patio', 'idle')],
        [],
        null,
      )?.queueId,
    ).toBe(PATIO)
  })
})

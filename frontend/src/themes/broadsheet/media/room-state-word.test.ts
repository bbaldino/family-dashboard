import { describe, expect, it } from 'vitest'
import { roomStateWord } from './room-state-word'
import type { Player } from '@/integrations/music'

const player = (over: Partial<Player> = {}): Player =>
  ({
    playerId: 'p1',
    displayName: 'Kitchen',
    state: 'idle',
    available: true,
    volumeLevel: 40,
    groupMembers: [],
    syncedTo: null,
    canGroupWith: [],
    groupVolume: null,
    ...over,
  }) as Player

describe('roomStateWord', () => {
  it('names a playing room', () => {
    expect(roomStateWord(player({ state: 'playing' }))).toBe('playing')
  })

  // Distinct from silent on purpose: a paused room resumes where it left off,
  // an idle one has nothing to resume.
  it('keeps paused distinct from silent', () => {
    expect(roomStateWord(player({ state: 'paused' }))).toBe('paused')
    expect(roomStateWord(player({ state: 'idle' }))).toBe('silent')
  })

  it('calls an unreachable room off, whatever state it last reported', () => {
    // A speaker that has dropped off the network is not quiet, it is gone —
    // and MA keeps reporting its last state, so availability has to win.
    expect(roomStateWord(player({ state: 'playing', available: false }))).toBe('off')
    expect(roomStateWord(player({ state: 'idle', available: false }))).toBe('off')
  })

  it('falls back to silent for a state it does not recognise', () => {
    expect(roomStateWord(player({ state: 'buffering' }))).toBe('silent')
  })
})

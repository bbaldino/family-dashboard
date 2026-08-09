import { describe, expect, it } from 'vitest'
import { playbackPhrase } from './playback-phrase'

describe('playbackPhrase', () => {
  it('claims playback only when the room is actually playing', () => {
    expect(playbackPhrase('playing')).toBe('Now playing in')
  })

  // The reported queue was paused, under a masthead reading "Now playing in".
  it('says a paused room is paused', () => {
    expect(playbackPhrase('paused')).toBe('Paused in')
  })

  it('treats a stopped room’s leftover track as the last thing it played', () => {
    expect(playbackPhrase('idle')).toBe('Last played in')
  })

  it('says a room with nothing on is quiet', () => {
    expect(playbackPhrase(null)).toBe('Quiet in')
  })
})

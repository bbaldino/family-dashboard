import { describe, expect, it } from 'vitest'
import { buildAlbumNote } from './album-note'

describe('buildAlbumNote', () => {
  it('reads well with the real-world combination: year, label, tracks, runtime', () => {
    // Push The Button — 11 tracks, ~56 min, label Virgin Records.
    const text = buildAlbumNote({ year: 2005, label: 'Virgin Records', trackCount: 11, runtimeSeconds: 3360 })
    expect(text).toBe('Released 2005 on Virgin Records — 11 tracks, running 56 min.')
  })

  it('drops the label clause when absent', () => {
    const text = buildAlbumNote({ year: 2005, label: null, trackCount: 11, runtimeSeconds: 3360 })
    expect(text).toBe('Released 2005 — 11 tracks, running 56 min.')
  })

  it('drops the year clause when absent', () => {
    const text = buildAlbumNote({ year: null, label: 'Virgin Records', trackCount: 11, runtimeSeconds: 3360 })
    expect(text).toBe('Released on Virgin Records — 11 tracks, running 56 min.')
  })

  it('falls back to just the track/runtime clause when both year and label are absent', () => {
    const text = buildAlbumNote({ year: null, label: null, trackCount: 3, runtimeSeconds: 615 })
    expect(text).toBe('3 tracks, running 10 min.')
  })

  it('uses singular "track" for a one-track album', () => {
    const text = buildAlbumNote({ year: 2020, label: null, trackCount: 1, runtimeSeconds: 200 })
    expect(text).toContain('1 track,')
    expect(text).not.toContain('1 tracks')
  })

  it('says something graceful for zero tracks rather than "0 tracks"', () => {
    const text = buildAlbumNote({ year: 2020, label: null, trackCount: 0, runtimeSeconds: 0 })
    expect(text).not.toContain('0 tracks')
    expect(text.toLowerCase()).toContain('no tracks')
  })

  it('is deterministic — same input, same prose', () => {
    const input = { year: 1997, label: 'Freestyle Dust', trackCount: 9, runtimeSeconds: 2820 }
    expect(buildAlbumNote(input)).toBe(buildAlbumNote(input))
  })

  it('never ends without terminal punctuation and never leaks undefined/null', () => {
    const cases = [
      { year: null, label: null, trackCount: 0, runtimeSeconds: 0 },
      { year: 2005, label: 'Virgin', trackCount: 11, runtimeSeconds: 3360 },
      { year: null, label: 'Virgin', trackCount: 4, runtimeSeconds: 900 },
    ]
    for (const input of cases) {
      const text = buildAlbumNote(input)
      expect(text.trimEnd()).toMatch(/[.!?]$/)
      expect(text).not.toContain('undefined')
      expect(text).not.toContain('null')
    }
  })
})

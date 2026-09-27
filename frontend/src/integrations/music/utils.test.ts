import { describe, expect, it } from 'vitest'
import { isSpotifyConnectUri } from './utils'

describe('isSpotifyConnectUri', () => {
  it('recognises the Spotify Connect plugin source, as MA reports it live', () => {
    expect(isSpotifyConnectUri('spotify_connect--DaDytfpf://audio_source/main')).toBe(true)
  })

  it('does not mistake a regular Spotify track for Spotify Connect', () => {
    expect(isSpotifyConnectUri('spotify--yC8brUbw://track/0ofHAoxe9vBkTCp2UQIavz')).toBe(false)
  })

  it('treats a missing uri as not Spotify Connect', () => {
    expect(isSpotifyConnectUri(null)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { decodeUriParam, encodeUriParam } from './track-url'

describe('track-url', () => {
  it('round-trips a Spotify artist URI', () => {
    const uri = 'spotify--Wzes6ES4://artist/1GhPHrq36VKCY3ucVaZCfo'
    expect(decodeUriParam(encodeUriParam(uri))).toBe(uri)
  })

  it('round-trips a URI with special characters', () => {
    const uri = 'library://album/Some Name (Deluxe)?x=1'
    expect(decodeUriParam(encodeUriParam(uri))).toBe(uri)
  })

  it('encoded value contains no unencoded slashes', () => {
    expect(encodeUriParam('spotify--x://artist/1')).not.toContain('/')
  })
})

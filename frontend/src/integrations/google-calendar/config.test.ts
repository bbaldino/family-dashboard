import { describe, expect, it } from 'vitest'
import { parseCalendarIds } from './config'

/**
 * These cases came from `fetchCalendarIds`, the raw `/api/config` reader this
 * replaced. Everything but the request itself survived the move: the value
 * now arrives from the shared config query, and every way of not having a
 * usable one still lands on `['primary']` rather than an empty fan-out that
 * would silently show an empty calendar.
 */
describe('parseCalendarIds', () => {
  it('returns the configured calendar ids when present', () => {
    expect(parseCalendarIds(JSON.stringify(['work@example.com', 'family@example.com']))).toEqual([
      'work@example.com',
      'family@example.com',
    ])
  })

  it('falls back to primary when no calendar_ids value is saved', () => {
    expect(parseCalendarIds(undefined)).toEqual(['primary'])
  })

  it('falls back to primary when the config has not loaded yet', () => {
    // `useIntegrationConfig` reads `null` both while the config is in flight
    // and when the integration is unconfigured.
    expect(parseCalendarIds(null)).toEqual(['primary'])
  })

  it('falls back to primary when the saved value is an empty array', () => {
    expect(parseCalendarIds(JSON.stringify([]))).toEqual(['primary'])
  })

  it('swallows malformed JSON in the saved value and falls back to primary', () => {
    expect(parseCalendarIds('not-json')).toEqual(['primary'])
  })
})

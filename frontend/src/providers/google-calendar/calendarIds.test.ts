import { describe, expect, it } from 'vitest'
import { parseCalendarIds } from './calendarIds'

/**
 * Pure parsing of a consumer's saved `calendar_ids` string. Every way of not
 * having a usable value lands on `['primary']` — Google's alias for the
 * account's default calendar — rather than an empty fan-out that would
 * silently show an empty calendar.
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
    // and when the consumer is unconfigured.
    expect(parseCalendarIds(null)).toEqual(['primary'])
  })

  it('falls back to primary when the saved value is an empty array', () => {
    expect(parseCalendarIds(JSON.stringify([]))).toEqual(['primary'])
  })

  it('swallows malformed JSON in the saved value and falls back to primary', () => {
    expect(parseCalendarIds('not-json')).toEqual(['primary'])
  })
})

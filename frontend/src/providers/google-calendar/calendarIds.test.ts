import { describe, expect, it } from 'vitest'
import { readCalendarIdsOrDefault, readStoredCalendarIds } from './calendarIds'

/**
 * `readStoredCalendarIds` is the edit-surface reading: exactly what is
 * stored, never a default. `readCalendarIdsOrDefault` is the fetch-time
 * reading: the same parse, with `'primary'` — Google's alias for the
 * account's default calendar — substituted in when nothing usable is
 * stored, so a fan-out never silently resolves to an empty (and
 * indistinguishable from quiet) calendar.
 */
describe('readStoredCalendarIds', () => {
  it('returns the configured calendar ids when present', () => {
    expect(
      readStoredCalendarIds(JSON.stringify(['work@example.com', 'family@example.com'])),
    ).toEqual(['work@example.com', 'family@example.com'])
  })

  it('returns an empty list when no calendar_ids value is saved', () => {
    expect(readStoredCalendarIds(undefined)).toEqual([])
  })

  it('returns an empty list when the config has not loaded yet', () => {
    // `useIntegrationConfig` reads `null` both while the config is in flight
    // and when the consumer is unconfigured.
    expect(readStoredCalendarIds(null)).toEqual([])
  })

  it('returns an empty list when the saved value is an empty array', () => {
    expect(readStoredCalendarIds(JSON.stringify([]))).toEqual([])
  })

  it('swallows malformed JSON in the saved value and returns an empty list', () => {
    expect(readStoredCalendarIds('not-json')).toEqual([])
  })
})

describe('readCalendarIdsOrDefault', () => {
  it('returns the configured calendar ids when present', () => {
    expect(
      readCalendarIdsOrDefault(JSON.stringify(['work@example.com', 'family@example.com'])),
    ).toEqual(['work@example.com', 'family@example.com'])
  })

  it('falls back to primary when no calendar_ids value is saved', () => {
    expect(readCalendarIdsOrDefault(undefined)).toEqual(['primary'])
  })

  it('falls back to primary when the config has not loaded yet', () => {
    expect(readCalendarIdsOrDefault(null)).toEqual(['primary'])
  })

  it('falls back to primary when the saved value is an empty array', () => {
    expect(readCalendarIdsOrDefault(JSON.stringify([]))).toEqual(['primary'])
  })

  it('swallows malformed JSON in the saved value and falls back to primary', () => {
    expect(readCalendarIdsOrDefault('not-json')).toEqual(['primary'])
  })
})

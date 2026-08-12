import { describe, expect, it } from 'vitest'
import { spansFromByDate } from './useMonthCalendar'
import type { CalendarEvent } from '@/providers/google-calendar'

const ev = (id: string, summary = id): CalendarEvent =>
  ({ id, summary, start: { date: '2026-05-01' }, end: { date: '2026-05-02' } }) as CalendarEvent

describe('spansFromByDate', () => {
  it('returns a span for an event occupying several days', () => {
    const trip = ev('trip', 'Baltimore & Boston')
    const spans = spansFromByDate({
      '2026-05-15': [trip],
      '2026-05-16': [trip],
      '2026-05-17': [trip],
      '2026-05-18': [trip],
    })
    expect(spans).toHaveLength(1)
    expect(spans[0]).toMatchObject({ startKey: '2026-05-15', endKey: '2026-05-18' })
    expect(spans[0].event.summary).toBe('Baltimore & Boston')
  })

  it('ignores an event that occupies a single day', () => {
    expect(spansFromByDate({ '2026-05-15': [ev('dentist')] })).toEqual([])
  })

  /**
   * The case the exclusive end date creates. A timed event running 11pm to 1am
   * has two different date keys, but `bucketByDate`'s walk stops before the
   * end key, so it fills exactly one day — and a one-cell banner would be a
   * chip with extra ceremony. Derivation from occupied days, rather than from
   * the raw start/end, is what makes this fall out for free.
   */
  it('ignores an event whose start and end dates differ but occupies one day', () => {
    expect(spansFromByDate({ '2026-05-15': [ev('late-night')] })).toEqual([])
  })

  it('keeps several overlapping spans separate', () => {
    const a = ev('a')
    const b = ev('b')
    const spans = spansFromByDate({
      '2026-05-15': [a],
      '2026-05-16': [a, b],
      '2026-05-17': [b],
    })
    expect(spans).toHaveLength(2)
    expect(spans.map((s) => s.event.id)).toEqual(['a', 'b'])
  })

  it('orders spans chronologically however the days were inserted', () => {
    const later = ev('later')
    const earlier = ev('earlier')
    // Insertion order deliberately reversed: `Object.entries` follows it, and
    // lane packing downstream is order-sensitive, so this must not depend on
    // which day happened to be added first.
    const spans = spansFromByDate({
      '2026-05-20': [later],
      '2026-05-21': [later],
      '2026-05-04': [earlier],
      '2026-05-05': [earlier],
    })
    expect(spans.map((s) => s.event.id)).toEqual(['earlier', 'later'])
  })

  it('bounds a span by its first and last day, not by insertion order', () => {
    const trip = ev('trip')
    const spans = spansFromByDate({
      '2026-05-17': [trip],
      '2026-05-15': [trip],
      '2026-05-16': [trip],
    })
    expect(spans[0]).toMatchObject({ startKey: '2026-05-15', endKey: '2026-05-17' })
  })

  it('returns nothing for an empty month', () => {
    expect(spansFromByDate({})).toEqual([])
  })
})

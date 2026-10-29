import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '@/providers/google-calendar'
import { formatEventLength } from './event-length'

const timed = (start: string, end?: string): CalendarEvent => ({
  id: 'e',
  start: { dateTime: start },
  end: end ? { dateTime: end } : {},
})

describe('formatEventLength', () => {
  it('reads minutes under an hour', () => {
    expect(formatEventLength(timed('2026-10-14T07:15:00', '2026-10-14T07:35:00'))).toBe('20 min')
  })

  it('reads whole hours without a minutes part', () => {
    expect(formatEventLength(timed('2026-10-14T16:00:00', '2026-10-14T17:00:00'))).toBe('1 hr')
    expect(formatEventLength(timed('2026-10-14T09:00:00', '2026-10-14T12:00:00'))).toBe('3 hr')
  })

  it('reads hours and minutes together', () => {
    expect(formatEventLength(timed('2026-10-14T19:00:00', '2026-10-14T20:30:00'))).toBe(
      '1 hr 30 min',
    )
  })

  it('has nothing to say about an all-day event', () => {
    const event: CalendarEvent = {
      id: 'e',
      start: { date: '2026-10-14' },
      end: { date: '2026-10-15' },
    }
    expect(formatEventLength(event)).toBeNull()
  })

  it('has nothing to say when the end is missing, unparseable, or not after the start', () => {
    expect(formatEventLength(timed('2026-10-14T09:00:00'))).toBeNull()
    expect(formatEventLength(timed('2026-10-14T09:00:00', 'nonsense'))).toBeNull()
    expect(formatEventLength(timed('2026-10-14T09:00:00', '2026-10-14T09:00:00'))).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { formatEventTime, formatTimeUntil, isAllDay, nextEventLabel } from './event-format'
import type { CalendarEvent } from '@/data/google-calendar'

const timed = (iso: string): CalendarEvent => ({
  id: '1',
  summary: 'Thing',
  start: { dateTime: iso },
  end: { dateTime: iso },
})

describe('event formatting', () => {
  it('detects all-day events by their date-only start', () => {
    expect(isAllDay({ id: '1', start: { date: '2026-05-22' }, end: { date: '2026-05-23' } })).toBe(
      true,
    )
    expect(isAllDay(timed('2026-05-22T14:15:00-07:00'))).toBe(false)
  })

  it('formats an all-day event as ALL DAY', () => {
    expect(
      formatEventTime({ id: '1', start: { date: '2026-05-22' }, end: { date: '2026-05-23' } }),
    ).toBe('ALL DAY')
  })

  it('formats a timed event as a wall-clock time', () => {
    expect(formatEventTime(timed('2026-05-22T14:15:00-07:00'))).toMatch(
      /^\d{1,2}:\d{2}\s?(AM|PM)$/i,
    )
  })

  it('does not throw on a malformed event', () => {
    expect(() => formatEventTime({ id: '1', start: {}, end: {} })).not.toThrow()
  })
})

describe('formatTimeUntil', () => {
  const now = new Date('2026-07-31T12:00:00-07:00')

  it('renders hours and minutes when at least an hour out', () => {
    expect(formatTimeUntil(new Date('2026-07-31T13:43:00-07:00'), now)).toBe('1h 43m')
  })

  it('renders minutes only when under an hour out', () => {
    expect(formatTimeUntil(new Date('2026-07-31T12:12:00-07:00'), now)).toBe('12m')
  })

  it('clamps a past target to zero rather than going negative', () => {
    expect(formatTimeUntil(new Date('2026-07-31T11:00:00-07:00'), now)).toBe('0m')
  })
})

describe('nextEventLabel', () => {
  const now = new Date('2026-07-31T12:00:00-07:00')

  it('falls back to "Tomorrow first" when there is no next event', () => {
    expect(nextEventLabel(undefined, now)).toBe('Tomorrow first')
  })

  it('counts down to a timed event', () => {
    expect(nextEventLabel(timed('2026-07-31T13:43:00-07:00'), now)).toBe('Next in 1h 43m')
  })

  it('has no clock time to count down from for an all-day event', () => {
    expect(
      nextEventLabel({ id: '1', start: { date: '2026-07-31' }, end: { date: '2026-08-01' } }, now),
    ).toBe('Next today')
  })
})

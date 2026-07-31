import { describe, expect, it } from 'vitest'
import { formatEventTime, isAllDay } from './event-format'
import type { CalendarEvent } from '@/data/google-calendar'

const timed = (iso: string): CalendarEvent => ({
  id: '1',
  summary: 'Thing',
  start: { dateTime: iso },
  end: { dateTime: iso },
})

describe('event formatting', () => {
  it('detects all-day events by their date-only start', () => {
    expect(isAllDay({ id: '1', start: { date: '2026-05-22' }, end: { date: '2026-05-23' } })).toBe(true)
    expect(isAllDay(timed('2026-05-22T14:15:00-07:00'))).toBe(false)
  })

  it('formats an all-day event as ALL DAY', () => {
    expect(formatEventTime({ id: '1', start: { date: '2026-05-22' }, end: { date: '2026-05-23' } })).toBe('ALL DAY')
  })

  it('formats a timed event as a wall-clock time', () => {
    expect(formatEventTime(timed('2026-05-22T14:15:00-07:00'))).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)$/i)
  })

  it('does not throw on a malformed event', () => {
    expect(() => formatEventTime({ id: '1', start: {}, end: {} })).not.toThrow()
  })
})

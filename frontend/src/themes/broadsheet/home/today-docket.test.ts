import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '@/providers/google-calendar'
import { allDayLine, splitTodayDocket } from './today-docket'

const timed = (id: string, start: string, end?: string): CalendarEvent => ({
  id,
  summary: id,
  start: { dateTime: start },
  end: end ? { dateTime: end } : {},
})

const allDay = (id: string): CalendarEvent => ({
  id,
  summary: id,
  start: { date: '2026-10-31' },
  end: { date: '2026-11-01' },
})

const at = (iso: string) => new Date(iso)

describe('splitTodayDocket', () => {
  it('moves events that have ended out of the docket, keeping their order', () => {
    const events = [
      timed('Parade', '2026-10-31T09:00:00-07:00', '2026-10-31T10:00:00-07:00'),
      timed('Lunch', '2026-10-31T12:00:00-07:00', '2026-10-31T13:00:00-07:00'),
      timed('Trick-or-treat', '2026-10-31T17:30:00-07:00', '2026-10-31T20:00:00-07:00'),
    ]

    const { earlier, ahead } = splitTodayDocket(events, at('2026-10-31T14:00:00-07:00'))

    expect(earlier.map((e) => e.id)).toEqual(['Parade', 'Lunch'])
    expect(ahead.map((e) => e.id)).toEqual(['Trick-or-treat'])
  })

  it('keeps an event that is under way in the docket until its end', () => {
    const event = timed('Party', '2026-10-31T13:00:00-07:00', '2026-10-31T15:00:00-07:00')

    expect(splitTodayDocket([event], at('2026-10-31T14:59:00-07:00')).ahead).toEqual([event])
    expect(splitTodayDocket([event], at('2026-10-31T15:00:00-07:00')).earlier).toEqual([event])
  })

  it('treats an event with no usable end as over once it starts', () => {
    const event = timed('Pickup', '2026-10-31T15:00:00-07:00')

    expect(splitTodayDocket([event], at('2026-10-31T14:59:00-07:00')).ahead).toEqual([event])
    expect(splitTodayDocket([event], at('2026-10-31T15:00:00-07:00')).earlier).toEqual([event])
  })

  it('sets all-day events apart, so they never take a row or end', () => {
    const event = allDay('Halloween')
    const party = timed('Party', '2026-10-31T13:00:00-07:00', '2026-10-31T15:00:00-07:00')

    expect(splitTodayDocket([event, party], at('2026-10-31T23:59:00-07:00'))).toEqual({
      allDay: [event],
      earlier: [party],
      ahead: [],
    })
  })

  it('keeps an event whose start cannot be read, rather than hiding it', () => {
    const event: CalendarEvent = { id: 'odd', start: { dateTime: 'not a time' }, end: {} }

    expect(splitTodayDocket([event], at('2026-10-31T23:59:00-07:00')).ahead).toEqual([event])
  })
})

describe('allDayLine', () => {
  it('lists all-day events by title', () => {
    expect(allDayLine([allDay('Halloween'), allDay('Daylight saving ends')])).toBe(
      'Halloween · Daylight saving ends',
    )
  })

  it('folds birthdays into one entry that names who', () => {
    // Today's real calendar, 2026-11-01.
    expect(allDayLine([allDay("John Oxaal's birthday"), allDay("Alaire Orme's birthday")])).toBe(
      'Birthdays: John Oxaal, Alaire Orme',
    )
    expect(allDayLine([allDay('Grandpa Birthday'), allDay('Halloween')])).toBe(
      'Birthday: Grandpa · Halloween',
    )
  })

  it('shows three entries and counts the rest', () => {
    const events = ['One', 'Two', 'Three', 'Four', 'Five'].map(allDay)
    expect(allDayLine(events)).toBe('One · Two · Three · +2 more')
  })

  it('names every birthday, however many, since they share one entry', () => {
    const events = ['A', 'B', 'C', 'D'].map((n) => allDay(`${n}'s birthday`))
    expect(allDayLine([...events, allDay('Halloween')])).toBe('Birthdays: A, B, C, D · Halloween')
  })
})

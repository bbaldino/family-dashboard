import { describe, expect, it } from 'vitest'
import { computeMonthTally } from './tally'
import type { CalendarEvent } from '@/integrations/google-calendar'

const timed = (id: string, summary: string): CalendarEvent => ({
  id,
  summary,
  start: { dateTime: '2026-05-10T16:00:00-07:00' },
  end: { dateTime: '2026-05-10T16:45:00-07:00' },
})

const allDay = (id: string, summary: string, date = '2026-05-10'): CalendarEvent => ({
  id,
  summary,
  start: { date },
  end: { date },
})

describe('computeMonthTally', () => {
  it('counts zero events and omits birthdays for an empty month', () => {
    expect(computeMonthTally({ byDate: {} }, 2026, 4)).toEqual({ eventCount: 0, birthdayCount: 0 })
  })

  it('counts events across the month', () => {
    const tally = computeMonthTally(
      {
        byDate: {
          '2026-05-01': [timed('a', 'Practice')],
          '2026-05-02': [timed('b', 'Recital'), timed('c', 'Pickup')],
        },
      },
      2026,
      4,
    )
    expect(tally.eventCount).toBe(3)
  })

  it('counts an all-day event whose summary ends in "\'s birthday" as a birthday', () => {
    const tally = computeMonthTally(
      { byDate: { '2026-05-03': [allDay('bd1', "Andi Wilson's birthday")] } },
      2026,
      4,
    )
    expect(tally.birthdayCount).toBe(1)
    expect(tally.eventCount).toBe(1)
  })

  it('does not classify a timed event as a birthday even if it says "birthday"', () => {
    const tally = computeMonthTally(
      { byDate: { '2026-05-03': [timed('party', "Emma's birthday party")] } },
      2026,
      4,
    )
    expect(tally.birthdayCount).toBe(0)
    expect(tally.eventCount).toBe(1)
  })

  it('does not classify an all-day event that merely mentions "birthday" mid-title', () => {
    const tally = computeMonthTally(
      { byDate: { '2026-05-03': [allDay('bagby', 'Birdies for Bagby')] } },
      2026,
      4,
    )
    expect(tally.birthdayCount).toBe(0)
    expect(tally.eventCount).toBe(1)
  })

  it('de-duplicates a multi-day event expanded across several days', () => {
    const spanning = allDay('trip', 'Grandma visiting', '2026-05-01')
    const tally = computeMonthTally(
      {
        byDate: {
          '2026-05-01': [spanning],
          '2026-05-02': [spanning],
          '2026-05-03': [spanning],
        },
      },
      2026,
      4,
    )
    expect(tally.eventCount).toBe(1)
  })

  it('ignores adjacent-month padding days outside year/month', () => {
    const tally = computeMonthTally(
      {
        byDate: {
          '2026-04-28': [timed('april-event', 'April errand')],
          '2026-05-01': [timed('may-event', 'May errand')],
          '2026-06-01': [timed('june-event', 'June errand')],
        },
      },
      2026,
      4,
    )
    expect(tally.eventCount).toBe(1)
  })
})

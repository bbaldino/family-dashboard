import { describe, expect, it } from 'vitest'
import { monthFixtureFor, weekFixtureFor } from './fixtures'

describe('monthFixtureFor', () => {
  it('returns undefined when no scenario is active', () => {
    expect(monthFixtureFor(null, 2026, 4)).toBeUndefined()
  })

  it('returns undefined for a scenario this integration does not define', () => {
    expect(monthFixtureFor('live-game', 2026, 4)).toBeUndefined()
  })

  it('empty scenario has no events on any date', () => {
    const { byDate } = monthFixtureFor('empty', 2026, 4)!
    expect(Object.keys(byDate)).toHaveLength(0)
  })

  it('packed scenario has a day carrying more events than the grid can show as pills (4)', () => {
    const { byDate } = monthFixtureFor('packed', 2026, 4)!
    const busiestDayCount = Math.max(...Object.values(byDate).map((events) => events.length))
    expect(busiestDayCount).toBeGreaterThan(4)
  })

  it('packed scenario is stable across the same month (no dependence on real "today")', () => {
    const a = monthFixtureFor('packed', 2026, 4)!
    const b = monthFixtureFor('packed', 2026, 4)!
    expect(a).toEqual(b)
  })

  it('spanning scenario places the same multi-day event on both sides of the month boundary', () => {
    const { byDate } = monthFixtureFor('spanning', 2026, 4)!
    const lastDayOfApril = '2026-04-30'
    const firstDayOfMay = '2026-05-01'
    const aprilIds = (byDate[lastDayOfApril] ?? []).map((e) => e.id)
    const mayIds = (byDate[firstDayOfMay] ?? []).map((e) => e.id)
    expect(aprilIds).not.toHaveLength(0)
    expect(mayIds).toEqual(aprilIds)
  })

  it('spanning scenario sorts the shared day all-day events first, then timed events chronologically', () => {
    const { byDate } = monthFixtureFor('spanning', 2026, 4)!
    const sharedDay = Object.entries(byDate).find(([, events]) => events.length > 1)
    expect(sharedDay).toBeDefined()
    const [, events] = sharedDay!
    const allDayCount = events.filter((e) => !e.start.dateTime).length
    const timedCount = events.filter((e) => !!e.start.dateTime).length
    expect(allDayCount).toBeGreaterThan(0)
    expect(timedCount).toBeGreaterThan(0)
    // Every all-day event precedes every timed event.
    const firstTimedIndex = events.findIndex((e) => !!e.start.dateTime)
    expect(events.slice(0, firstTimedIndex).every((e) => !e.start.dateTime)).toBe(true)
  })
})

describe('weekFixtureFor', () => {
  it('returns undefined when no scenario is active', () => {
    expect(weekFixtureFor(null)).toBeUndefined()
  })

  it('returns undefined for a scenario this integration does not define', () => {
    expect(weekFixtureFor('live-game')).toBeUndefined()
  })

  it('always returns today plus six more days, with only the first marked as today', () => {
    const days = weekFixtureFor('packed')!
    expect(days).toHaveLength(7)
    expect(days[0].isToday).toBe(true)
    expect(days.slice(1).every((d) => !d.isToday)).toBe(true)
  })

  it('empty scenario has no events on any day', () => {
    const days = weekFixtureFor('empty')!
    expect(days.every((d) => d.events.length === 0)).toBe(true)
  })

  it("packed scenario overloads today's events well past the week-ahead per-day cap (2)", () => {
    const days = weekFixtureFor('packed')!
    expect(days[0].events.length).toBeGreaterThan(2)
  })
})

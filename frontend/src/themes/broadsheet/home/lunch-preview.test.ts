import { describe, expect, it } from 'vitest'
import { pickLunchPreview } from './lunch-preview'
import type { LunchMenuData, LunchMenuDay } from '@/integrations/nutrislice'

const day = (name: string): LunchMenuDay => ({
  date: '2026-08-17',
  dayName: name,
  entries: [{ name: 'Pizza', withItems: [], isAlternative: false }],
  extras: [],
})

const at = (hour: number) => new Date(2026, 7, 17, hour, 0)
const menu = (today: LunchMenuDay | null, tomorrow: LunchMenuDay | null): LunchMenuData => ({
  today,
  tomorrow,
  week: [],
})

describe('pickLunchPreview', () => {
  it('shows today before noon on a school day', () => {
    const p = pickLunchPreview(menu(day('Mon'), day('Tue')), at(9))
    expect(p.label).toBe('today')
    expect(p.day?.dayName).toBe('Mon')
  })

  it('flips to tomorrow from noon on', () => {
    const p = pickLunchPreview(menu(day('Mon'), day('Tue')), at(12))
    expect(p.label).toBe('tomorrow')
    expect(p.day?.dayName).toBe('Tue')
  })

  it('after noon on a Friday, tomorrow is the weekend — nothing to preview', () => {
    const p = pickLunchPreview(menu(day('Fri'), null), at(14))
    expect(p.label).toBe('tomorrow')
    expect(p.day).toBeNull()
  })

  it('on a Sunday morning there is no today, so it looks ahead to Monday', () => {
    const p = pickLunchPreview(menu(null, day('Mon')), at(9))
    expect(p.label).toBe('tomorrow')
    expect(p.day?.dayName).toBe('Mon')
  })

  it('on a Saturday, nothing today or tomorrow either way', () => {
    const morning = pickLunchPreview(menu(null, null), at(9))
    expect(morning).toEqual({ day: null, label: 'today' })
    const afternoon = pickLunchPreview(menu(null, null), at(14))
    expect(afternoon).toEqual({ day: null, label: 'tomorrow' })
  })
})

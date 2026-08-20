import { describe, expect, it } from 'vitest'
import { buildStandfirstFacts } from './standfirst-facts'

// 2026-08-17 is a Monday; 2 pm local → "afternoon".
const mondayAfternoon = new Date(2026, 7, 17, 14, 0)

describe('buildStandfirstFacts', () => {
  it('assembles a full day into a coarse fact block', () => {
    const facts = buildStandfirstFacts({
      now: mondayAfternoon,
      birthdays: [],
      events: [
        { title: 'Soccer practice', time: '4:00 PM' },
        { title: 'Piano lesson', time: '5:00 PM' },
      ],
      sports: { kind: 'pregame', away: 'the Dodgers', home: 'the Rockies', firstPitch: '7:10 PM' },
      weather: { tempF: 79, description: 'overcast clouds' },
    })
    expect(facts).toBe(
      [
        '- Monday afternoon',
        '- Calendar, still to come: Soccer practice (4:00 PM), Piano lesson (5:00 PM)',
        '- Baseball: the Dodgers at the Rockies, first pitch 7:10 PM',
        '- Weather: 79°F, overcast clouds',
      ].join('\n'),
    )
  })

  it('surfaces birthdays as their own fact, near the top', () => {
    const facts = buildStandfirstFacts({
      now: mondayAfternoon,
      birthdays: ["Grandpa's Birthday"],
      events: [{ title: 'Soccer practice', time: '4:00 PM' }],
      sports: { kind: 'none' },
      weather: null,
    })
    expect(facts).toBe(
      [
        '- Monday afternoon',
        "- Birthdays today: Grandpa's Birthday",
        '- Calendar, still to come: Soccer practice (4:00 PM)',
      ].join('\n'),
    )
  })

  it('says nothing-to-come and omits absent facts', () => {
    const facts = buildStandfirstFacts({
      now: mondayAfternoon,
      birthdays: [],
      events: [],
      sports: { kind: 'none' },
      weather: null,
    })
    expect(facts).toBe(['- Monday afternoon', '- Calendar: nothing still to come today'].join('\n'))
  })

  it('keeps a live game coarse — never a score', () => {
    // The whole reason live sport is coarse: a score would change every pitch
    // and thrash the cache key. "on now" is stable through the game.
    const facts = buildStandfirstFacts({
      now: mondayAfternoon,
      birthdays: [],
      events: [],
      sports: { kind: 'live' },
      weather: null,
    })
    expect(facts).toContain('- Baseball: the game is on now')
    expect(facts).not.toMatch(/\d+\s*[-–]\s*\d+/)
  })
})

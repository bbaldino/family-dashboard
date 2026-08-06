import { describe, it, expect } from 'vitest'
import { formatIncidentWhen, formatDuration, isOngoing } from './incidents'
import type { Incident } from './types'

const at = (iso: string) => Math.floor(new Date(iso).getTime() / 1000)

const incident = (over: Partial<Incident> = {}): Incident => ({
  monitor_id: 7,
  monitor_name: 'Unraid',
  started_at: at('2026-07-30T04:12:00Z'),
  ended_at: at('2026-07-30T04:34:00Z'),
  duration_secs: 1320,
  worst_status: 'degraded',
  message: 'Degraded: free space',
  failing_components: [],
  ...over,
})

describe('formatDuration', () => {
  it('reads minutes under an hour, as the mock does', () => {
    expect(formatDuration(1320)).toBe('22m')
  })

  it('reads hours and minutes above one', () => {
    expect(formatDuration(6600)).toBe('1h 50m')
  })

  it('drops a zero minute remainder', () => {
    expect(formatDuration(7200)).toBe('2h')
  })

  /** A blip shorter than a minute still happened; "0m" reads as nothing. */
  it('keeps sub-minute incidents visible', () => {
    expect(formatDuration(42)).toBe('42s')
  })
})

describe('isOngoing', () => {
  /** `ended_at: null` means ongoing, not missing — the upstream deliberately
   *  has no separate `resolved` flag for the two to disagree about. */
  it('treats a null end as still happening', () => {
    expect(isOngoing(incident({ ended_at: null }))).toBe(true)
  })

  it('treats an end time as finished', () => {
    expect(isOngoing(incident())).toBe(false)
  })
})

describe('formatIncidentWhen', () => {
  /** `now` is pinned rather than left to default to the real clock: the
   *  weekday form only applies inside the 6-day window, so relying on the
   *  wall clock made this pass until the fixture aged out of it and then fail
   *  every run thereafter. The sibling test below always pinned `now`. */
  it('reads as weekday and clock time, as the mock does', () => {
    expect(formatIncidentWhen(incident(), at('2026-07-30T12:00:00Z'))).toMatch(
      /^[A-Z]{3} \d{2}:\d{2}$/,
    )
  })

  /** An incident is returned whole, so a 7-day ledger can contain a row that
   *  began before the window. A bare weekday would date such a row to the
   *  wrong week, so anything older switches to a calendar date. (Asserting the
   *  shape rather than a month: the suite runs in Pacific and the fixture is
   *  UTC, so the month itself is a timezone question, not a formatting one.) */
  it('dates a row that began before the window', () => {
    const old = incident({ started_at: at('2026-07-01T04:12:00Z') })

    expect(formatIncidentWhen(old, at('2026-07-30T12:00:00Z'))).toMatch(
      /^[A-Z]{3} \d{1,2} \d{2}:\d{2}$/,
    )
  })
})

import { describe, expect, it } from 'vitest'
import { computeUptimeWindows } from './uptime-windows'
import type { Incident } from './types'

const HOUR = 3600
const DAY = 24 * HOUR
const NOW = 1_800_000_000

const incident = (over: Partial<Incident> = {}): Incident =>
  ({
    monitor_id: 1,
    monitor_name: 'Plex',
    started_at: NOW - HOUR,
    ended_at: NOW,
    duration_secs: HOUR,
    worst_status: 'critical',
    message: null,
    ...over,
  }) as Incident

const pct = (windows: ReturnType<typeof computeUptimeWindows>, label: string) =>
  windows.find((w) => w.label === label)!.pct

describe('computeUptimeWindows', () => {
  it('reports a clean fleet as 100% across every window', () => {
    const w = computeUptimeWindows([], 8, NOW)
    expect(w.map((x) => x.pct)).toEqual([100, 100, 100])
  })

  it('spreads one service’s outage across the whole fleet', () => {
    // One hour down, on one of eight monitors, over a 24-hour window:
    // 1 / (24 × 8) = 0.52% of the fleet's day.
    const w = computeUptimeWindows([incident()], 8, NOW)
    expect(pct(w, '24 hours')).toBeCloseTo(100 - (100 * HOUR) / (DAY * 8), 4)
  })

  /**
   * The reason incidents are clipped rather than counted whole. An outage
   * that started four days ago contributed only its last 24 hours to the
   * 24-hour figure; counting `duration_secs` would report more downtime than
   * the window contains and drive the percentage negative.
   */
  it('clips an incident that began before the window opened', () => {
    const long = incident({ started_at: NOW - 4 * DAY, ended_at: NOW, duration_secs: 4 * DAY })
    const w = computeUptimeWindows([long], 1, NOW)
    // The whole 24h window was down, but only the 24h window.
    expect(pct(w, '24 hours')).toBe(0)
    // Four of seven days down, not four of one.
    expect(pct(w, '7 days')).toBeCloseTo(100 * (1 - 4 / 7), 4)
  })

  it('treats a null end as ongoing, clipped at now', () => {
    const ongoing = incident({
      started_at: NOW - 2 * HOUR,
      ended_at: null,
      // Deliberately absurd: `duration_secs` is counted to now and must not be
      // what the sum uses.
      duration_secs: 999 * DAY,
    })
    const w = computeUptimeWindows([ongoing], 1, NOW)
    expect(pct(w, '24 hours')).toBeCloseTo(100 * (1 - 2 / 24), 4)
  })

  it('ignores an incident that closed before the window opened', () => {
    const old = incident({ started_at: NOW - 40 * DAY, ended_at: NOW - 39 * DAY })
    const w = computeUptimeWindows([old], 4, NOW)
    expect(pct(w, '24 hours')).toBe(100)
    expect(pct(w, '30 days')).toBe(100)
  })

  it('adds up several incidents in the same window', () => {
    const a = incident({ started_at: NOW - 3 * HOUR, ended_at: NOW - 2 * HOUR })
    const b = incident({ monitor_id: 2, started_at: NOW - HOUR, ended_at: NOW })
    const w = computeUptimeWindows([a, b], 2, NOW)
    expect(pct(w, '24 hours')).toBeCloseTo(100 * (1 - (2 * HOUR) / (DAY * 2)), 4)
  })

  it('never reports below zero, however much downtime is recorded', () => {
    // More recorded downtime than the window can hold — overlapping incidents
    // across the same monitor would otherwise drive this negative.
    const many = Array.from({ length: 10 }, () =>
      incident({ started_at: NOW - DAY, ended_at: NOW, duration_secs: DAY }),
    )
    const w = computeUptimeWindows(many, 1, NOW)
    expect(pct(w, '24 hours')).toBe(0)
  })

  it('reports null rather than a percentage when there are no monitors', () => {
    // Dividing by a fleet of zero is not 100% uptime, it is no answer.
    expect(computeUptimeWindows([], 0, NOW).map((w) => w.pct)).toEqual([null, null, null])
  })
})

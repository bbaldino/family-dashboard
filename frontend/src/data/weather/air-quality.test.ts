import { describe, expect, it } from 'vitest'
import { computeAirQuality } from './air-quality'

/**
 * Port of `backend/src/integrations/weather/air_quality.rs`'s banding —
 * boundaries mirror that file's own `#[cfg(test)]` module exactly (see
 * `aqi_level_boundaries`, `uv_level_boundaries`, `pollen_level_boundaries`,
 * `reshape_takes_max_pollen_species_and_ignores_nulls`,
 * `reshape_handles_all_pollen_null`, `reshape_handles_everything_missing`),
 * so a future edit that drifts from the Rust bands fails here first.
 */

function airResponse(current: Record<string, number | null>) {
  return { current }
}

describe('computeAirQuality — aqi bands (aqi_level_boundaries)', () => {
  const cases: [number, string][] = [
    [0, 'good'],
    [50, 'good'],
    [51, 'moderate'],
    [100, 'moderate'],
    [101, 'unhealthy_sensitive'],
    [150, 'unhealthy_sensitive'],
    [151, 'unhealthy'],
    [200, 'unhealthy'],
    [201, 'very_unhealthy'],
    [300, 'very_unhealthy'],
    [301, 'hazardous'],
    [500, 'hazardous'],
  ]

  it.each(cases)('us_aqi=%i -> %s', (aqi, level) => {
    const out = computeAirQuality(airResponse({ us_aqi: aqi }))
    expect(out.aqi).toBe(aqi)
    expect(out.aqi_level).toBe(level)
  })
})

describe('computeAirQuality — uv bands (uv_level_boundaries)', () => {
  const cases: [number, string][] = [
    [0.0, 'low'],
    [2.9, 'low'],
    [3.0, 'moderate'],
    [5.9, 'moderate'],
    [6.0, 'high'],
    [7.9, 'high'],
    [8.0, 'very_high'],
    [10.9, 'very_high'],
    [11.0, 'extreme'],
    [15.0, 'extreme'],
  ]

  it.each(cases)('uv_index=%f -> %s', (uv, level) => {
    const out = computeAirQuality(airResponse({ uv_index: uv }))
    expect(out.uv_index).toBe(uv)
    expect(out.uv_level).toBe(level)
  })
})

describe('computeAirQuality — pollen bands (pollen_level_boundaries)', () => {
  const cases: [number, string][] = [
    [0.0, 'none'],
    [30.0, 'low'],
    [30.1, 'moderate'],
    [50.0, 'moderate'],
    [50.1, 'high'],
    [150.0, 'high'],
    [150.1, 'very_high'],
  ]

  it.each(cases)('max pollen=%f -> %s', (grains, level) => {
    const out = computeAirQuality(airResponse({ grass_pollen: grains }))
    expect(out.pollen).toBe(grains)
    expect(out.pollen_level).toBe(level)
  })
})

describe('computeAirQuality — max across species, nulls ignored (reshape_takes_max_pollen_species_and_ignores_nulls)', () => {
  it('takes the max reading across all six species and rounds aqi', () => {
    const out = computeAirQuality(
      airResponse({
        us_aqi: 55.0,
        uv_index: 10.55,
        alder_pollen: null,
        birch_pollen: 4.0,
        grass_pollen: 12.0,
        mugwort_pollen: null,
        olive_pollen: 2.0,
        ragweed_pollen: null,
      }),
    )
    expect(out.aqi).toBe(55)
    expect(out.aqi_level).toBe('moderate')
    expect(out.uv_index).toBe(10.55)
    expect(out.uv_level).toBe('very_high')
    expect(out.pollen).toBe(12.0)
    expect(out.pollen_level).toBe('low')
  })
})

describe('computeAirQuality — all pollen null degrades to null, not zero (reshape_handles_all_pollen_null)', () => {
  it('the real-world US-location case: aqi/uv populated, every pollen species null', () => {
    const out = computeAirQuality(
      airResponse({
        us_aqi: 55.0,
        uv_index: 10.55,
      }),
    )
    expect(out.aqi).toBe(55)
    expect(out.pollen).toBeNull()
    expect(out.pollen_level).toBeNull()
  })
})

describe('computeAirQuality — everything missing (reshape_handles_everything_missing)', () => {
  it('degrades every field to null rather than throwing', () => {
    const out = computeAirQuality({ current: {} })
    expect(out.aqi).toBeNull()
    expect(out.aqi_level).toBeNull()
    expect(out.uv_index).toBeNull()
    expect(out.uv_level).toBeNull()
    expect(out.pollen).toBeNull()
    expect(out.pollen_level).toBeNull()
  })

  it('also degrades cleanly when `current` itself is absent', () => {
    const out = computeAirQuality({})
    expect(out.aqi).toBeNull()
    expect(out.pollen_level).toBeNull()
  })
})

describe('computeAirQuality — live payload shape (task-3-report.md)', () => {
  it('matches the live-verified all-pollen-null San Jose reading', () => {
    // Captured live in task 3: POST /api/fetch/weather/air, 37.2504/-121.9.
    const out = computeAirQuality({
      current: {
        alder_pollen: null,
        birch_pollen: null,
        grass_pollen: null,
        interval: 3600,
        mugwort_pollen: null,
        olive_pollen: null,
        ragweed_pollen: null,
        time: '2026-08-04T06:00',
        us_aqi: 58,
        uv_index: 0.0,
      },
    })
    expect(out).toEqual({
      aqi: 58,
      aqi_level: 'moderate',
      uv_index: 0.0,
      uv_level: 'low',
      pollen: null,
      pollen_level: null,
    })
  })
})

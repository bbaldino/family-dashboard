import { describe, expect, it } from 'vitest'
import { summariseForecast } from './forecast'

/**
 * Port of `backend/src/integrations/weather/routes.rs`'s `get_forecast`
 * daily-bucketing logic. Fixtures use OpenWeather's real 5-day/3-hour
 * forecast shape (`list[].dt`, `list[].main`, `list[].weather[0]`,
 * `list[].pop`, `city.timezone`) — the previous task's review flagged `pop`
 * and `timezone` as easy to drop by accident during this port, so several
 * tests below exist specifically to fail if either is silently ignored.
 */

function entry(
  dt: number,
  opts: {
    temp?: number
    temp_min: number
    temp_max: number
    humidity?: number
    pop?: number
    main?: string
    description?: string
    icon?: string
  },
) {
  return {
    dt,
    main: {
      temp: opts.temp ?? (opts.temp_min + opts.temp_max) / 2,
      temp_min: opts.temp_min,
      temp_max: opts.temp_max,
      humidity: opts.humidity ?? 50,
    },
    weather: [
      {
        main: opts.main ?? 'Clear',
        description: opts.description ?? 'clear sky',
        icon: opts.icon ?? '01d',
      },
    ],
    pop: opts.pop ?? 0,
  }
}

// San Jose, CA — the household's real configured location (task-3-report.md)
// — PDT, UTC-7.
const SJ_TZ_OFFSET = -25200

describe('summariseForecast — daily temp_min/temp_max aggregation', () => {
  it('takes the max of temp_max and the min of temp_min across a day’s entries', () => {
    // 2026-08-04 09:00, 12:00, 15:00 UTC — all comfortably inside one UTC
    // day so tz-offset bucketing isn't exercised here (that's the next
    // describe block).
    const base = Date.UTC(2026, 7, 4, 9, 0, 0) / 1000
    const raw = {
      list: [
        entry(base, { temp_min: 60, temp_max: 70 }),
        entry(base + 3 * 3600, { temp_min: 58, temp_max: 75 }),
        entry(base + 6 * 3600, { temp_min: 62, temp_max: 72 }),
      ],
      city: { timezone: 0 },
    }
    const out = summariseForecast(raw)
    expect(out.daily).toHaveLength(1)
    expect(out.daily[0].temp_min).toBe(58)
    expect(out.daily[0].temp_max).toBe(75)
  })

  it('rounds temp_max/temp_min to one decimal place, matching the Rust `(x*10).round()/10`', () => {
    const base = Date.UTC(2026, 7, 4, 9, 0, 0) / 1000
    const raw = {
      list: [entry(base, { temp_min: 58.94, temp_max: 68.376 })],
      city: { timezone: 0 },
    }
    const out = summariseForecast(raw)
    expect(out.daily[0].temp_min).toBe(58.9)
    expect(out.daily[0].temp_max).toBe(68.4)
  })
})

describe('summariseForecast — humidity averaging and pop max', () => {
  it('averages humidity and rounds to a whole number', () => {
    const base = Date.UTC(2026, 7, 4, 9, 0, 0) / 1000
    const raw = {
      list: [
        entry(base, { temp_min: 60, temp_max: 70, humidity: 40 }),
        entry(base + 3 * 3600, { temp_min: 60, temp_max: 70, humidity: 55 }),
      ],
      city: { timezone: 0 },
    }
    const out = summariseForecast(raw)
    // (40 + 55) / 2 = 47.5 -> rounds to 48
    expect(out.daily[0].humidity).toBe(48)
  })

  it('takes the max `pop` across the day and expresses it as a rounded percentage — dropped by accident once already', () => {
    const base = Date.UTC(2026, 7, 4, 9, 0, 0) / 1000
    const raw = {
      list: [
        entry(base, { temp_min: 60, temp_max: 70, pop: 0.1 }),
        entry(base + 3 * 3600, { temp_min: 60, temp_max: 70, pop: 0.67 }),
        entry(base + 6 * 3600, { temp_min: 60, temp_max: 70, pop: 0.3 }),
      ],
      city: { timezone: 0 },
    }
    const out = summariseForecast(raw)
    expect(out.daily[0].pop).toBe(67)
  })
})

describe('summariseForecast — condition preference for midday (12:00-15:00 local)', () => {
  it('prefers a midday-local entry’s condition over the first entry of the day', () => {
    const base = Date.UTC(2026, 7, 4, 6, 0, 0) / 1000 // 06:00 UTC, first entry
    const raw = {
      list: [
        entry(base, { temp_min: 60, temp_max: 70, main: 'Clouds', description: 'overcast' }),
        // 13:00 UTC — inside the 12-15 midday window at tz offset 0.
        entry(base + 7 * 3600, {
          temp_min: 60,
          temp_max: 70,
          main: 'Clear',
          description: 'clear sky',
        }),
      ],
      city: { timezone: 0 },
    }
    const out = summariseForecast(raw)
    expect(out.daily[0].condition).toBe('Clear')
    expect(out.daily[0].description).toBe('clear sky')
  })

  it('falls back to the first entry’s condition when nothing falls in the midday window', () => {
    const base = Date.UTC(2026, 7, 4, 3, 0, 0) / 1000 // 03:00 and 06:00 UTC — no midday entry
    const raw = {
      list: [
        entry(base, { temp_min: 60, temp_max: 70, main: 'Rain', description: 'light rain' }),
        entry(base + 3 * 3600, {
          temp_min: 60,
          temp_max: 70,
          main: 'Clouds',
          description: 'overcast',
        }),
      ],
      city: { timezone: 0 },
    }
    const out = summariseForecast(raw)
    expect(out.daily[0].condition).toBe('Rain')
  })
})

describe('summariseForecast — city.timezone bucketing (dropped by accident once already)', () => {
  it('buckets by local date, not UTC date, using city.timezone', () => {
    // 2026-08-05 02:00 UTC is still 2026-08-04 local at UTC-7 (San Jose).
    // A naive UTC-date bucketing would put this in the wrong day.
    const dt = Date.UTC(2026, 7, 5, 2, 0, 0) / 1000
    const raw = {
      list: [entry(dt, { temp_min: 55, temp_max: 65 })],
      city: { timezone: SJ_TZ_OFFSET },
    }
    const out = summariseForecast(raw)
    expect(out.daily).toHaveLength(1)
    expect(out.daily[0].date).toBe('2026-08-04')
  })

  it('splits entries either side of local midnight into two different days', () => {
    const evening = Date.UTC(2026, 7, 5, 4, 0, 0) / 1000 // 2026-08-04 21:00 local
    const nextMorning = Date.UTC(2026, 7, 5, 8, 0, 0) / 1000 // 2026-08-05 01:00 local
    const raw = {
      list: [
        entry(evening, { temp_min: 55, temp_max: 65 }),
        entry(nextMorning, { temp_min: 50, temp_max: 60 }),
      ],
      city: { timezone: SJ_TZ_OFFSET },
    }
    const out = summariseForecast(raw)
    expect(out.daily.map((d) => d.date)).toEqual(['2026-08-04', '2026-08-05'])
  })

  it('defaults the offset to 0 when city.timezone is missing', () => {
    const dt = Date.UTC(2026, 7, 4, 12, 0, 0) / 1000
    const raw = { list: [entry(dt, { temp_min: 55, temp_max: 65 })], city: {} }
    const out = summariseForecast(raw)
    expect(out.daily[0].date).toBe('2026-08-04')
  })
})

describe('summariseForecast — daily entries sorted chronologically', () => {
  it('sorts days ascending regardless of input order', () => {
    const day1 = Date.UTC(2026, 7, 4, 12, 0, 0) / 1000
    const day2 = Date.UTC(2026, 7, 5, 12, 0, 0) / 1000
    const raw = {
      list: [
        entry(day2, { temp_min: 50, temp_max: 60 }),
        entry(day1, { temp_min: 55, temp_max: 65 }),
      ],
      city: { timezone: 0 },
    }
    const out = summariseForecast(raw)
    expect(out.daily.map((d) => d.date)).toEqual(['2026-08-04', '2026-08-05'])
  })
})

describe('summariseForecast — hourly (next 8 entries, as-is)', () => {
  it('takes exactly the first 8 entries, not bucketed, carrying temp/condition/pop/humidity', () => {
    const base = Date.UTC(2026, 7, 4, 12, 0, 0) / 1000
    const list = Array.from({ length: 10 }, (_, i) =>
      entry(base + i * 3 * 3600, {
        temp: 60 + i,
        temp_min: 60 + i,
        temp_max: 60 + i,
        humidity: 30 + i,
        pop: 0.1 * i,
      }),
    )
    const out = summariseForecast({ list, city: { timezone: 0 } })
    expect(out.hourly).toHaveLength(8)
    expect(out.hourly[0]).toEqual({
      dt: base,
      temp: 60,
      condition: 'Clear',
      description: 'clear sky',
      icon: '01d',
      pop: 0,
      humidity: 30,
    })
    expect(out.hourly[3].pop).toBe(30) // 0.1 * 3 = 0.3 -> 30%
    expect(out.hourly[3].humidity).toBe(33)
  })
})

describe('summariseForecast — real payload shape (task-3-report.md)', () => {
  it('handles a representative OpenWeather 5-day/3-hour response without throwing', () => {
    // Shaped like the live-verified response: cnt 40, list[], city{timezone}.
    const base = Date.UTC(2026, 7, 4, 21, 0, 0) / 1000
    const list = Array.from({ length: 40 }, (_, i) =>
      entry(base + i * 3 * 3600, { temp_min: 65, temp_max: 70 }),
    )
    const out = summariseForecast({
      list,
      city: { id: 5333219, name: 'Cambrian Park', timezone: SJ_TZ_OFFSET },
    })
    expect(out.daily.length).toBeGreaterThan(0)
    expect(out.hourly).toHaveLength(8)
  })
})

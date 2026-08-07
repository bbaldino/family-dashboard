import type { z } from 'zod'
import type { UsePollingResult } from '@/integrations/types'
import { useIntegrationData } from '@/platform'
import { nutrisliceIntegration } from './config'
import { parseLocalDate, toLocalDateStr } from '@/utils/date'

interface NutriSliceItem {
  text: string
  food?: { name?: string; id?: number; food_category?: string }
  is_holiday?: boolean
  is_section_title?: boolean
  no_line_break?: boolean
  position?: number
}

interface NutriSliceDay {
  date: string
  menu_items: NutriSliceItem[]
}

interface NutriSliceResponse {
  days: NutriSliceDay[]
}

// A menu entry is a main item with optional "with" sides
export interface MenuEntry {
  name: string
  withItems: string[] // "w/ Cornbread", "w/ Spanish Rice", etc.
  isAlternative: boolean // joined via "OR" to the previous entry
}

export interface LunchMenuDay {
  date: string
  dayName: string
  entries: MenuEntry[]
  extras: string[] // standalone items like "Variety of Milk", "Salad Station"
}

export interface LunchMenuData {
  today: LunchMenuDay | null
  tomorrow: LunchMenuDay | null
  week: LunchMenuDay[]
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
}

// Items to exclude from display
const EXCLUDED_FOOD_IDS = [1722974]
const KNOWN_EXTRAS = ['variety of milk', 'milk', 'salad station']

function isExcluded(item: NutriSliceItem): boolean {
  if (item.is_holiday) return true
  if (item.is_section_title) return true
  if (item.food?.id && EXCLUDED_FOOD_IDS.includes(item.food.id)) return true
  return false
}

function getItemName(item: NutriSliceItem): string {
  return item.text || item.food?.name || ''
}

function isKnownExtra(name: string): boolean {
  return KNOWN_EXTRAS.includes(name.toLowerCase())
}

function parseDayMenu(day: NutriSliceDay | undefined): LunchMenuDay | null {
  if (!day) return null

  // Sort by position (matches how NutriSlice orders them)
  const sorted = [...day.menu_items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  const entries: MenuEntry[] = []
  const extras: string[] = []

  for (const item of sorted) {
    if (isExcluded(item)) continue

    const name = getItemName(item)
    if (!name) continue

    // Known extras (milk, salad station) go to the extras list
    if (isKnownExtra(name)) {
      extras.push(name)
      continue
    }

    // "OR" text joins alternatives
    if (name === 'OR') {
      // Mark the next entry as an alternative (handled when next item is processed)
      if (entries.length > 0) {
        entries[entries.length - 1].name += ' or'
      }
      continue
    }

    // no_line_break = true: this is a "with" item for the previous entry
    if (item.no_line_break && entries.length > 0) {
      entries[entries.length - 1].withItems.push(name)
      continue
    }

    // Check if previous entry ends with " or" — this item is the alternative
    const isAlt = entries.length > 0 && entries[entries.length - 1].name.endsWith(' or')
    if (isAlt) {
      // Clean up the " or" from previous entry
      entries[entries.length - 1].name = entries[entries.length - 1].name.slice(0, -3)
      entries.push({ name, withItems: [], isAlternative: true })
      continue
    }

    // New main entry
    entries.push({ name, withItems: [], isAlternative: false })
  }

  if (entries.length === 0 && extras.length === 0) return null

  const date = parseLocalDate(day.date)
  return {
    date: day.date,
    dayName: date.toLocaleDateString([], { weekday: 'long' }),
    entries,
    extras,
  }
}

function nextMonday(from: Date): Date {
  const d = new Date(from)
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7))
  return d
}

type NutriSliceConfig = z.infer<typeof nutrisliceIntegration.schema>

/**
 * `date` is a **path segment** (`YYYY/MM/DD`, slashes and all), not a query
 * value — mirrors the deleted Rust route's `format!(".../{}", date)`. It
 * must go in unencoded; running the whole date string through
 * `encodeURIComponent` would turn its slashes into `%2F` and break the
 * upstream path.
 */
function menuUrl(cfg: NutriSliceConfig, dateSegment: string): string {
  return `https://${cfg.district}.api.nutrislice.com/menu/api/weeks/school/${cfg.school}/menu-type/${cfg.menu_type}/${dateSegment}?format=json`
}

// NutriSlice publishes a week's menu at a time and updates it at most once a
// day (typically overnight). The hook itself only re-polls hourly (below),
// so caching the upstream response for an hour keeps the backend
// fetch-proxy cache warm between polls — every poll inside the same hour is
// served from cache — without ever risking a menu update going unseen for
// more than the hook's own poll cadence.
const MENU_TTL_SECS = 60 * 60

function useWeekMenu(dateSegment: string) {
  // No explicit `<Raw, Out>` type args — per `useWeatherData`'s comment in
  // `integrations/weather/index.ts`, that would leave `T` unfilled and
  // fall back to its `never`-ish default, which then rejects
  // `nutrisliceIntegration`'s concrete config shape below. `select` is a
  // pass-through (the response is used raw — see `deriveLunchMenu`), but
  // typing its parameter is what lets `Raw` and `T` both infer correctly
  // from the arguments instead.
  return useIntegrationData(
    nutrisliceIntegration,
    (cfg) => ({
      url: menuUrl(cfg, dateSegment),
      ttlSecs: MENU_TTL_SECS,
    }),
    {
      select: (d: NutriSliceResponse): NutriSliceResponse => d,
      refetchInterval: 60 * 60 * 1000, // hourly
    },
  )
}

function deriveLunchMenu(
  thisWeek: NutriSliceResponse,
  nextWeek: NutriSliceResponse,
): LunchMenuData {
  const now = new Date()
  const allDays = [...(thisWeek.days ?? []), ...(nextWeek.days ?? [])]

  const todayStr = toLocalDateStr(now)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = toLocalDateStr(tomorrow)

  const todayData = thisWeek.days?.find((d) => d.date === todayStr)
  const tomorrowData = allDays.find((d) => d.date === tomorrowStr)

  const week: LunchMenuDay[] = allDays
    .map((d: NutriSliceDay) => parseDayMenu(d))
    .filter((d: LunchMenuDay | null): d is LunchMenuDay => d != null)
    .filter((d: LunchMenuDay) => {
      const dayDate = parseLocalDate(d.date)
      const todayDate = new Date()
      todayDate.setHours(0, 0, 0, 0)
      return dayDate >= todayDate
    })
    .slice(0, 5)

  return {
    today: parseDayMenu(todayData),
    tomorrow: parseDayMenu(tomorrowData),
    week,
  }
}

export type LunchMenuResult = UsePollingResult<LunchMenuData>

/**
 * Composes two upstream weeks (this week + next, for the expanded view) into
 * one `LunchMenuData` and adapts the pair of `useIntegrationData` results
 * back to `UsePollingResult` — the shared return-shape contract which four
 * consumers (`LunchMenuWidget`, the grid widget-meta, broadsheet's `Home`
 * and `HouseholdColumn`) still depend on. `HouseholdColumn` in particular
 * documents relying on `data` being `null` (not `undefined`) until a fetch
 * has actually succeeded, so that contract is preserved exactly: `data` is
 * `null` unless *both* weeks have loaded, matching the old `fetchMenu`,
 * which threw (and left the query without data) if either await failed.
 */
export function useLunchMenu(): LunchMenuResult {
  const now = new Date()
  const thisWeek = useWeekMenu(formatDate(now))
  const nextWeek = useWeekMenu(formatDate(nextMonday(now)))

  const data = thisWeek.data && nextWeek.data ? deriveLunchMenu(thisWeek.data, nextWeek.data) : null

  const errorObj = thisWeek.error ?? nextWeek.error

  return {
    data,
    error: errorObj ? errorObj.message : null,
    isLoading: thisWeek.isLoading || nextWeek.isLoading,
    refetch: async () => {
      await Promise.all([thisWeek.refetch(), nextWeek.refetch()])
    },
  }
}

import { usePolling, type UsePollingResult } from '@/hooks/usePolling'
import { nutrisliceIntegration } from './config'

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
  const sorted = [...day.menu_items].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  )

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
    const isAlt =
      entries.length > 0 && entries[entries.length - 1].name.endsWith(' or')
    if (isAlt) {
      // Clean up the " or" from previous entry
      entries[entries.length - 1].name = entries[entries.length - 1].name.slice(
        0,
        -3,
      )
      entries.push({ name, withItems: [], isAlternative: true })
      continue
    }

    // New main entry
    entries.push({ name, withItems: [], isAlternative: false })
  }

  if (entries.length === 0 && extras.length === 0) return null

  const date = new Date(day.date + 'T12:00:00')
  return {
    date: day.date,
    dayName: date.toLocaleDateString([], { weekday: 'long' }),
    entries,
    extras,
  }
}

async function fetchMenu(): Promise<LunchMenuData> {
  const now = new Date()
  const dateStr = formatDate(now)

  const data = await nutrisliceIntegration.api!.get<NutriSliceResponse>(
    `/menu?date=${encodeURIComponent(dateStr)}`,
  )

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

  const todayData = data.days?.find((d) => d.date === todayStr)
  const tomorrowData = data.days?.find((d) => d.date === tomorrowStr)

  return {
    today: parseDayMenu(todayData),
    tomorrow: parseDayMenu(tomorrowData),
  }
}

export type LunchMenuResult = UsePollingResult<LunchMenuData>

export function useLunchMenu(): LunchMenuResult {
  return usePolling<LunchMenuData>({
    queryKey: ['nutrislice', 'menu'],
    fetcher: fetchMenu,
    intervalMs: 60 * 60 * 1000, // hourly
  })
}

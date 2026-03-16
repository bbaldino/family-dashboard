import { usePolling, type UsePollingResult } from '@/hooks/usePolling'

export interface NutriSliceDay {
  date: string
  menu_items: Array<{
    text: string
    food?: { name?: string; food_category?: string }
    food_category?: string
    is_holiday?: boolean
    is_section_title?: boolean
  }>
}

interface NutriSliceResponse {
  days: NutriSliceDay[]
}

export interface LunchMenuItem {
  name: string
}

export interface LunchMenuDay {
  date: string
  dayName: string
  entrees: LunchMenuItem[]
  sides: LunchMenuItem[]
}

export interface LunchMenuData {
  today: LunchMenuDay | null
  tomorrow: LunchMenuDay | null
}

export function todayDayName(): string {
  return new Date().toLocaleDateString([], { weekday: 'long' })
}

export function isWeekday(): boolean {
  const day = new Date().getDay()
  return day >= 1 && day <= 5
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
}

function isEntree(item: NutriSliceDay['menu_items'][number]): boolean {
  // Items with category "entree" are entrees
  const cat = item.food?.food_category || item.food_category || ''
  if (cat === 'entree') return true
  // Items with a text field but no food object are top-level entrees (e.g. "Carne Asada Rice Bowl")
  if (item.text && !item.food) return true
  return false
}

function parseDayMenu(day: NutriSliceDay | undefined): LunchMenuDay | null {
  if (!day) return null

  const validItems = day.menu_items.filter(
    (item) => !item.is_holiday && (item.text || item.food?.name),
  )

  if (validItems.length === 0) return null

  const entrees: LunchMenuItem[] = []
  const sides: LunchMenuItem[] = []

  for (const item of validItems) {
    const name = item.text || item.food?.name || ''
    if (!name) continue

    if (item.is_section_title) {
      sides.push({ name })
    } else if (isEntree(item)) {
      entrees.push({ name })
    } else {
      sides.push({ name })
    }
  }

  // If no entrees detected, treat the first item as an entree
  if (entrees.length === 0 && sides.length > 0) {
    entrees.push(sides.shift()!)
  }

  if (entrees.length === 0 && sides.length === 0) return null

  const date = new Date(day.date + 'T12:00:00')
  return {
    date: day.date,
    dayName: date.toLocaleDateString([], { weekday: 'long' }),
    entrees,
    sides,
  }
}

async function fetchMenu(): Promise<LunchMenuData> {
  const now = new Date()
  const dateStr = formatDate(now)

  const resp = await fetch(`/api/nutrislice/menu?date=${encodeURIComponent(dateStr)}`)
  if (!resp.ok) {
    throw new Error(`Menu fetch failed: ${resp.status}`)
  }

  const data: NutriSliceResponse = await resp.json()

  const todayStr = now.toISOString().split('T')[0]
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

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
    fetcher: fetchMenu,
    intervalMs: 60 * 60 * 1000, // hourly
  })
}

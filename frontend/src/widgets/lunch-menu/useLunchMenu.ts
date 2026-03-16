import { usePolling, type UsePollingResult } from '@/hooks/usePolling'

export interface NutriSliceDay {
  date: string
  menu_items: Array<{
    text: string
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
  items: LunchMenuItem[]
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

function parseDayMenu(day: NutriSliceDay | undefined): LunchMenuDay | null {
  if (!day) return null

  const items = day.menu_items
    .filter((item) => !item.is_holiday && !item.is_section_title && item.text)
    .map((item) => ({ name: item.text }))

  if (items.length === 0) return null

  const date = new Date(day.date + 'T12:00:00')
  return {
    date: day.date,
    dayName: date.toLocaleDateString([], { weekday: 'long' }),
    items,
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

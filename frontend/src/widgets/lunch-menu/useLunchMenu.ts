import { usePolling, type UsePollingResult } from '@/hooks/usePolling'
import { lunchMenuApi, type LunchMenu } from '@/lib/dashboard-api'

function currentWeekMonday(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(now.getFullYear(), now.getMonth(), diff).toISOString().split('T')[0]
}

export function todayDayName(): string {
  return new Date().toLocaleDateString([], { weekday: 'long' })
}

export function isWeekday(): boolean {
  const day = new Date().getDay()
  return day >= 1 && day <= 5
}

export type LunchMenuData = UsePollingResult<LunchMenu>

export function useLunchMenu(): LunchMenuData {
  return usePolling<LunchMenu>({
    fetcher: () => {
      const week = currentWeekMonday()
      return lunchMenuApi.get(week)
    },
    intervalMs: 60 * 60 * 1000,
  })
}

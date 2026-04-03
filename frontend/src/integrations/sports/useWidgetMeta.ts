import type { WidgetMeta } from '@/lib/widget-types'
import { useSportsGames } from './useSportsGames'

export function useSportsWidgetMeta(): WidgetMeta {
  const { data } = useSportsGames()
  const games = data?.games ?? []

  const hasLive = games.some((g) => g.state === 'live')
  const hasUpcomingToday = games.some((g) => {
    if (g.state !== 'upcoming') return false
    const start = new Date(g.startTime)
    const now = new Date()
    return start.toDateString() === now.toDateString()
  })
  const hasFinal = games.some((g) => g.state === 'final')
  const hasUpcoming = games.some((g) => g.state === 'upcoming')

  let preferredSize: WidgetMeta['preferredSize'] = 'standard'
  let priority = 1

  if (hasLive) {
    preferredSize = 'expanded'
    priority = 10
  } else if (hasUpcomingToday) {
    preferredSize = 'expanded'
    priority = 5
  } else if (hasFinal) {
    preferredSize = 'standard'
    priority = 2
  } else if (hasUpcoming) {
    preferredSize = 'standard'
    priority = 3
  }

  return {
    supportedSizes: ['compact', 'standard', 'expanded'],
    preferredSize,
    priority,
  }
}

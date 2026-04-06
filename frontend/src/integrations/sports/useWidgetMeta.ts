import type { WidgetMeta } from '@/lib/widget-types'
import { useSportsGames } from './useSportsGames'

export function useSportsWidgetMeta(): WidgetMeta {
  const { data } = useSportsGames()
  const games = data?.games ?? []

  if (games.length === 0) {
    return { visible: false }
  }

  const hasLive = games.some((g) => g.state === 'live')
  const hasUpcomingToday = games.some((g) => {
    if (g.state !== 'upcoming') return false
    const start = new Date(g.startTime)
    const now = new Date()
    return start.toDateString() === now.toDateString()
  })
  const hasFinal = games.some((g) => g.state === 'final')
  const hasUpcoming = games.some((g) => g.state === 'upcoming')

  if (hasLive) {
    return { visible: true, sizePreference: { orientation: 'horizontal', relativeSize: 'xlarge' }, priority: 10 }
  }
  if (hasUpcomingToday) {
    return { visible: true, sizePreference: { orientation: 'horizontal', relativeSize: 'large' }, priority: 5 }
  }
  if (hasUpcoming) {
    return { visible: true, sizePreference: { orientation: 'square', relativeSize: 'medium' }, priority: 3 }
  }
  if (hasFinal) {
    return { visible: true, sizePreference: { orientation: 'horizontal', relativeSize: 'large' }, priority: 4 }
  }

  return { visible: true, sizePreference: { orientation: 'square', relativeSize: 'medium' }, priority: 1 }
}

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { activeScenario } from '@/lib/scenario'
import { musicIntegration } from './config'
import { useMusic } from './useMusic'
import { musicQueueItemsFixtureFor } from './fixtures'

export interface QueueItem {
  queue_item_id?: string
  position?: number
  /** Seconds. Confirmed present on the live queue passthrough (both here and on media_item). */
  duration?: number
  media_item: {
    name: string
    uri: string
    media_type?: string
    artists?: { name?: string }[]
    image?: { path?: string } | null
    metadata?: { images?: { path?: string }[] }
  }
}

/**
 * Fetch upcoming items for the given queue. Refetches periodically and
 * also whenever the active track changes (which signals the queue
 * advanced one step).
 */
export function useQueue(queueId: string | null | undefined) {
  const queryClient = useQueryClient()
  const { state } = useMusic()
  const currentUri = state.activeQueue?.currentItem?.uri ?? null

  const query = useQuery({
    queryKey: ['music', 'queue', queueId],
    queryFn: () => {
      const fixture = musicQueueItemsFixtureFor(activeScenario, queueId)
      return fixture
        ? Promise.resolve(fixture)
        : musicIntegration.api.get<QueueItem[]>(`/queue/${queueId}`)
    },
    enabled: !!queueId,
    refetchInterval: 30 * 1000,
  })

  // Re-fetch when the active track changes — that's a good signal that
  // the queue has advanced or been reshuffled.
  useEffect(() => {
    if (!queueId) return
    queryClient.invalidateQueries({ queryKey: ['music', 'queue', queueId] })
  }, [currentUri, queueId, queryClient])

  return query
}

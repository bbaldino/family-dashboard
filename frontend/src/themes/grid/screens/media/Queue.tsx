import { Music } from 'lucide-react'
import { useMusic, useQueue } from '@/integrations/music'
import type { QueueItem } from '@/integrations/music'

function imageFor(item: QueueItem): string | null {
  return item.media_item.image?.path ?? item.media_item.metadata?.images?.[0]?.path ?? null
}

function artistFor(item: QueueItem): string {
  return item.media_item.artists?.[0]?.name ?? ''
}

export function Queue() {
  const { state } = useMusic()
  const queueId = state.activeQueue?.queueId ?? null
  const currentUri = state.activeQueue?.currentItem?.uri ?? null
  const { data, isLoading } = useQueue(queueId)

  if (!queueId) return null
  if (isLoading && !data) {
    return <div className="px-4 py-3 text-text-secondary text-xs">Loading queue…</div>
  }
  if (!data || data.length === 0) return null

  // Slice down to just the upcoming items — items at or before the current
  // position have already played and aren't useful here.
  const currentIdx = currentUri ? data.findIndex((item) => item.media_item.uri === currentUri) : -1
  const upcoming = currentIdx >= 0 ? data.slice(currentIdx + 1) : data

  if (upcoming.length === 0) return null

  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <div className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">
        Up Next ({upcoming.length})
      </div>
      <ul className="flex flex-col gap-1 max-h-[420px] overflow-y-auto">
        {upcoming.slice(0, 50).map((item, i) => {
          const imgUrl = imageFor(item)
          const key = item.queue_item_id ?? `${item.media_item.uri}-${i}`
          return (
            <li
              key={key}
              className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-bg-primary"
            >
              <div className="w-9 h-9 rounded overflow-hidden flex-shrink-0 bg-bg-primary flex items-center justify-center">
                {imgUrl ? (
                  <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Music size={14} className="text-text-secondary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-text-primary text-sm truncate">{item.media_item.name}</div>
                <div className="text-text-secondary text-xs truncate">{artistFor(item)}</div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

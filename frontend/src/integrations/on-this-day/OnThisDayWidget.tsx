import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { WidgetCard } from '@/ui/WidgetCard'

interface OnThisDayEvent {
  year: number
  text: string
}

async function fetchOnThisDay(): Promise<OnThisDayEvent[]> {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  const resp = await fetch(
    `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/selected/${month}/${day}`,
  )
  if (!resp.ok) throw new Error('Failed to fetch')
  const data = await resp.json()
  const events: OnThisDayEvent[] = (data.selected ?? data.events ?? []).map(
    (e: any) => ({
      year: e.year,
      text: e.text,
    }),
  )
  return events
}

export function OnThisDayWidget() {
  const [index, setIndex] = useState(0)

  const { data: events, isLoading } = useQuery({
    queryKey: ['on-this-day'],
    queryFn: fetchOnThisDay,
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
  })

  const advance = useCallback(() => {
    if (events && events.length > 0) {
      setIndex((prev) => (prev + 1) % events.length)
    }
  }, [events])

  if (isLoading || !events || events.length === 0) {
    return (
      <WidgetCard title="On This Day" category="info">
        <div className="text-text-muted text-sm">Loading...</div>
      </WidgetCard>
    )
  }

  const event = events[index % events.length]

  return (
    <WidgetCard title="On This Day" category="info" badge={`${event.year}`}>
      <div className="flex flex-col gap-2 h-full">
        <p className="text-text-primary text-sm leading-relaxed flex-1">
          {event.text}
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation()
            advance()
          }}
          className="self-end p-1.5 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-primary transition-colors"
        >
          <RefreshCw size={14} />
        </button>
      </div>
    </WidgetCard>
  )
}

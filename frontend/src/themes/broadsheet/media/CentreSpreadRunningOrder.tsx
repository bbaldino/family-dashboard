import { useQueue } from '@/integrations/music'
import type { QueueItem } from '@/integrations/music'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'
import { MAX_RUNNING_ORDER_ROWS } from './centre-spread-capacity'

/** `m:ss`, floored — matches `NowSpinning.tsx`'s own `formatDuration` (not
 *  shared: see that file's own comment on why per-screen copies of this
 *  are the theme's convention). */
function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

function artistFor(item: QueueItem): string {
  return item.media_item.artists?.[0]?.name ?? ''
}

const rowGridStyle = {
  display: 'grid',
  gridTemplateColumns: '22px 1fr auto',
  gap: 10,
  alignItems: 'baseline' as const,
  padding: '9px 0',
}

const titleStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: 15,
  fontWeight: 500,
  lineHeight: 1.2,
}

const artistStyle = {
  fontFamily: 'var(--font-display)',
  fontStyle: 'italic' as const,
  fontSize: 12.5,
  color: 'var(--ink-muted)',
  marginTop: 1,
}

/**
 * The right column — the running order (mock `nowplaying.jsx:185-226`): the
 * current track as the list's head, then upcoming queue items.
 *
 * **No Shuffle/Repeat/Queue buttons.** The mock pins three action buttons
 * to the column's foot. Checked against `backend/src/integrations/music/routes.rs`:
 * there is no shuffle or repeat endpoint — only `debug_command`, an
 * explicitly-debug passthrough not meant for product UI — and "Queue" would
 * just re-open the list this column already is. Rendering any of the three
 * would be a button that does nothing, which the design brief already rules
 * out for the progress bar's handle for the same reason.
 *
 * **Capped, not unbounded.** `useQueue` returns however many items the
 * backend's queue holds, with no upper bound — see `centre-spread-capacity.ts`
 * for how the cap was measured. The remainder is named as "+N more" rather
 * than silently dropped, the convention every other capped list in this
 * theme follows.
 */
export function CentreSpreadRunningOrder({
  queueId,
  current,
}: {
  queueId: string
  current: { title: string; artist: string; uri: string | null }
}) {
  const { data } = useQueue(queueId)
  const items = data ?? []

  // The queue passthrough includes the currently-playing item itself —
  // everything from one past it onward is what's actually "up next" (same
  // logic grid's own `Queue.tsx` uses, read for reference only).
  const currentIdx = current.uri
    ? items.findIndex((item) => item.media_item.uri === current.uri)
    : -1
  const upcoming = currentIdx >= 0 ? items.slice(currentIdx + 1) : items
  const visible = upcoming.slice(0, MAX_RUNNING_ORDER_ROWS)
  const hiddenCount = upcoming.length - visible.length

  return (
    <aside
      className="min-h-0 overflow-hidden flex flex-col"
      style={{ padding: '18px 56px 18px 24px' }}
    >
      <div className="flex items-baseline justify-between">
        <Kicker>Running order</Kicker>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--ink-muted)',
            letterSpacing: '0.12em',
          }}
        >
          {upcoming.length} up next
        </span>
      </div>

      <div style={{ ...rowGridStyle, borderTop: '2px solid var(--ink)', marginTop: 8 }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--rust)',
            fontWeight: 700,
          }}
        >
          ▸
        </span>
        <div className="min-w-0">
          <div
            className="truncate"
            style={{ ...titleStyle, fontWeight: 600, color: 'var(--rust)' }}
          >
            {current.title}
          </div>
          <div className="truncate" style={artistStyle}>
            {current.artist}
          </div>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--rust)',
            letterSpacing: '0.06em',
          }}
        >
          now
        </span>
      </div>

      <ul
        className="m-0 p-0 min-h-0 overflow-hidden"
        style={{ listStyle: 'none', display: 'flex', flexDirection: 'column' }}
      >
        {visible.map((item, i) => (
          <li
            key={item.queue_item_id ?? `${item.media_item.uri}-${i}`}
            style={{ ...rowGridStyle, borderTop: '1px dotted var(--rule)' }}
          >
            <span
              style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)' }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0">
              <div className="truncate" style={titleStyle}>
                {item.media_item.name}
              </div>
              <div className="truncate" style={artistStyle}>
                {artistFor(item)}
              </div>
            </div>
            {item.duration != null && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--ink-muted)',
                  letterSpacing: '0.06em',
                }}
              >
                {formatDuration(item.duration)}
              </span>
            )}
          </li>
        ))}
      </ul>

      {hiddenCount > 0 && (
        <div
          style={{
            marginTop: 4,
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--ink-muted)',
            letterSpacing: '0.1em',
          }}
        >
          +{hiddenCount} more
        </div>
      )}
    </aside>
  )
}

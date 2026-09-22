import { useRef, useState } from 'react'
import { useDoorbellToday, snapshotUrl, clipUrl, posterUrl } from '@/integrations/cameras'
import type { Visit } from '@/integrations/cameras'

const fmtTime = (unix: number) =>
  new Date(unix * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const fmtDur = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`)

/**
 * The "Today" tab's master-detail: a player showing the selected visit's
 * clips (auto-advancing within the visit, then to the next-older visit) and
 * a scrollable list of everyone who's rung the bell today. Mock:
 * `.superpowers/brainstorm/488636-1790035444/content/today-mockup.html`.
 *
 * The player's poster is the full-frame snapshot (`posterUrl`) — it reads
 * better at the player's large 16:9 size than the person-crop thumbnail used
 * for list tiles (`snapshotUrl`), which is right-sized for a 64×48 tile.
 */
export function TodayRecordings() {
  const { visits, loading, error } = useDoorbellToday()
  const [selected, setSelected] = useState<Visit | null>(null)
  const [clipIdx, setClipIdx] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Default selection = newest visit, derived rather than pushed into state
  // by an effect: once the hook's fetch resolves, `visits[0]` is already the
  // right answer, so there's nothing to synchronize after the fact. Once the
  // household picks a visit, `selected` takes over.
  const current = selected ?? visits[0] ?? null

  const onEnded = () => {
    if (!current) return
    if (clipIdx + 1 < current.clipEventIds.length) {
      setClipIdx(clipIdx + 1) // next clip in this visit
    } else {
      const i = visits.findIndex((v) => v.id === current.id)
      const nextOlder = visits[i + 1]
      if (nextOlder) {
        setSelected(nextOlder)
        setClipIdx(0)
      }
    }
  }

  const pick = (v: Visit) => {
    setSelected(v)
    setClipIdx(0)
  }

  if (error)
    return (
      <div className="cam-note" data-testid="today-recordings">
        Couldn’t reach the cameras.
      </div>
    )
  if (loading)
    return (
      <div className="cam-note" data-testid="today-recordings">
        Loading today’s visits…
      </div>
    )
  if (!visits.length)
    return (
      <div className="cam-note" data-testid="today-recordings">
        No one’s been by today.
      </div>
    )

  const currentClip = current?.clipEventIds[clipIdx]

  return (
    <div className="today-recordings" data-testid="today-recordings">
      <div className="player-col">
        {currentClip && (
          <video
            ref={videoRef}
            src={clipUrl(currentClip)}
            poster={current ? posterUrl(current.snapshotEventId) : undefined}
            controls
            autoPlay
            onEnded={onEnded}
          />
        )}
        {current && (
          <div className="cap">
            <span className="when">{fmtTime(current.start)}</span>
            <span className="meta">
              {current.count} clip{current.count > 1 ? 's' : ''} · {fmtDur(current.durationS)} ·
              doorbell
            </span>
          </div>
        )}
      </div>
      <ul className="visit-list">
        {visits.map((v) => (
          <li key={v.id} className={v.id === current?.id ? 'on' : ''} onClick={() => pick(v)}>
            <img src={snapshotUrl(v.snapshotEventId)} alt="" />
            <div className="info">
              <div className="t">{fmtTime(v.start)}</div>
              <div className="c">
                {v.count} clip{v.count > 1 ? 's' : ''} · {fmtDur(v.durationS)}
              </div>
            </div>
            {v.count > 1 && <span className="badge">{v.count}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

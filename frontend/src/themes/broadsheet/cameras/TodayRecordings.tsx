import { useState } from 'react'
import { useDoorbellToday, snapshotUrl, clipUrl, posterUrl } from '@/integrations/cameras'
import type { Visit } from '@/integrations/cameras'

const fmtTime = (unix: number) =>
  new Date(unix * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const fmtClipTime = (unix: number) =>
  new Date(unix * 1000).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
const fmtDur = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`)

/**
 * The "Today" tab's master-detail. Nothing plays on its own: the player shows
 * a placeholder until you pick a visit, then a visit's chosen clip as a poster
 * with a play button — click to play, it plays that one clip and stops. Tapping
 * a visit selects its representative clip and, if the visit has more than one
 * clip, expands its clips inline so you can pick a specific one. Mock:
 * `.superpowers/brainstorm/488636-1790035444/content/today-mockup.html`.
 *
 * A "visit" is our grouping of Frigate events that fired within a few minutes
 * of each other; the clips themselves are separate Frigate recordings, never
 * concatenated — so the expanded list is just those individual clips.
 */
export function TodayRecordings() {
  const { visits, loading, error } = useDoorbellToday()
  // Which visit's clips are expanded, and which clip is loaded in the player.
  // Both null on first load, so the player shows its placeholder — nothing is
  // selected or playing until the household picks a visit.
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null)
  const [selectedClipEventId, setSelectedClipEventId] = useState<string | null>(null)

  // Tapping a visit expands it and loads its representative (best-scored) clip
  // into the player as a poster — never autoplaying, and never rolling into the
  // next clip or visit.
  const pickVisit = (v: Visit) => {
    setExpandedVisitId(v.id)
    setSelectedClipEventId(v.snapshotEventId)
  }
  const pickClip = (eventId: string) => setSelectedClipEventId(eventId)

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

  const selectedVisit = selectedClipEventId
    ? visits.find((v) => v.clips.some((c) => c.eventId === selectedClipEventId))
    : undefined
  const clipIndex = selectedVisit
    ? selectedVisit.clips.findIndex((c) => c.eventId === selectedClipEventId)
    : -1
  const selectedClip = selectedVisit && clipIndex >= 0 ? selectedVisit.clips[clipIndex] : undefined

  return (
    <div className="today-recordings" data-testid="today-recordings">
      <div className="player-col">
        {selectedClipEventId ? (
          // No autoplay: the poster shows and the native control starts it. Keyed
          // on the clip id so picking another clip swaps the source cleanly.
          <video
            key={selectedClipEventId}
            src={clipUrl(selectedClipEventId)}
            poster={posterUrl(selectedClipEventId)}
            controls
          />
        ) : (
          <div className="player-placeholder" data-testid="player-placeholder">
            <svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true">
              <rect
                x="2.5"
                y="6"
                width="14"
                height="12"
                rx="2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <path d="M16.5 10l5-3v10l-5-3z" fill="none" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            <div className="ph-kicker">Front door · today</div>
            <div className="ph-line">Select a visit to watch it.</div>
          </div>
        )}
        {selectedClip && selectedVisit && (
          <div className="cap">
            <span className="when">{fmtClipTime(selectedClip.start)}</span>
            <span className="meta">
              {selectedVisit.count > 1 ? `Clip ${clipIndex + 1} of ${selectedVisit.count} · ` : ''}
              doorbell
            </span>
          </div>
        )}
      </div>
      <ul className="visit-list">
        {visits.map((v) => {
          const expanded = v.id === expandedVisitId
          return (
            <li key={v.id} className={expanded ? 'on' : ''}>
              <button type="button" className="visit-row" onClick={() => pickVisit(v)}>
                <img src={snapshotUrl(v.snapshotEventId)} alt="" />
                <div className="info">
                  <div className="t">{fmtTime(v.start)}</div>
                  <div className="c">
                    {v.count} clip{v.count > 1 ? 's' : ''} · {fmtDur(v.durationS)}
                  </div>
                </div>
                {v.count > 1 && <span className="badge">{v.count}</span>}
              </button>
              {expanded && v.clips.length > 1 && (
                <div className="clip-list">
                  {v.clips.map((clip, i) => (
                    <button
                      type="button"
                      key={clip.eventId}
                      className={`clip${clip.eventId === selectedClipEventId ? ' on' : ''}`}
                      onClick={() => pickClip(clip.eventId)}
                    >
                      <img src={snapshotUrl(clip.eventId)} alt="" />
                      <span className="clip-t">{fmtClipTime(clip.start)}</span>
                      <span className="clip-n">#{i + 1}</span>
                    </button>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

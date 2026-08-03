import { statusTone } from './tone'
import { severity, type Status, type UptimeReport } from './types'

/**
 * Bucketize a window into fixed-count blocks, painting each block with the
 * worst status any segment covering that block held. Matches the discretized
 * status-page look — 48 buckets for 24h ≈ one every 30min.
 */
function bucketStatuses(report: UptimeReport, buckets: number): Status[] {
  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - report.window_secs
  const bucketSize = report.window_secs / buckets
  const out: Status[] = new Array(buckets).fill(null)

  for (const seg of report.segments) {
    const segStart = Math.max(seg.start, windowStart)
    const segEnd = Math.min(seg.end, now)
    if (segEnd <= segStart) continue
    const startBucket = Math.floor((segStart - windowStart) / bucketSize)
    const endBucket = Math.min(buckets - 1, Math.floor((segEnd - windowStart) / bucketSize))
    for (let b = startBucket; b <= endBucket; b++) {
      // null means "no data yet" for this bucket — always yield to real data.
      // Otherwise, worst status wins (critical > unknown > degraded > ok).
      if (out[b] === null || severity(seg.status) > severity(out[b])) {
        out[b] = seg.status
      }
    }
  }
  return out
}

export function UptimeBar({ report, buckets = 48 }: { report: UptimeReport; buckets?: number }) {
  const painted = bucketStatuses(report, buckets)
  return (
    <div className="flex gap-[2px]">
      {painted.map((s, i) => {
        const tone = statusTone(s)
        return (
          <div key={i} className={`h-6 flex-1 rounded-[2px] ${tone.bg}`} title={s ?? 'no data'} />
        )
      })}
    </div>
  )
}

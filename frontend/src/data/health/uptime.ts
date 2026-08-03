import { severity, type Status, type UptimeSegment } from './types'

/** The mock's bar is 48 half-hour blocks across a day (`health.jsx`). */
export const BLOCKS_24H = 48

/**
 * Resamples the API's arbitrary uptime spans onto the fixed block count the bar
 * draws.
 *
 * Two rules earn their keep. A block with no segment covering it is `unknown`,
 * not `ok` — a service we have no record for must not read as healthy. And when
 * several statuses fall inside one block the *worst* wins: a six-minute outage
 * inside a half-hour block is the only thing about that block worth knowing,
 * and averaging would paint a clean day straight over it.
 */
export function bucketSegments(
  segments: UptimeSegment[],
  now: number,
  windowSecs: number,
  blocks: number = BLOCKS_24H,
): Status[] {
  const blockSecs = windowSecs / blocks
  const start = now - windowSecs

  return Array.from({ length: blocks }, (_, i) => {
    const blockStart = start + i * blockSecs
    const blockEnd = blockStart + blockSecs

    let worst: Status | null = null
    for (const seg of segments) {
      if (seg.end <= blockStart || seg.start >= blockEnd) continue
      if (worst === null || severity(seg.status) > severity(worst)) worst = seg.status
    }
    return worst ?? 'unknown'
  })
}

/**
 * The instant a report's window ends, taken from the report itself.
 *
 * The alternative — the browser's own clock — drifts against the server that
 * built the segments, so a tablet a few minutes fast would draw empty
 * "unknown" blocks on the right of every bar and look like an outage. Anchoring
 * to the newest segment keeps the bar aligned with the data that drew it.
 */
export function windowEndOf(segments: UptimeSegment[]): number | null {
  let end: number | null = null
  for (const seg of segments) if (end === null || seg.end > end) end = seg.end
  return end
}

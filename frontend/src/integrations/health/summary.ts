import { severity, type Service, type Status } from './types'

export interface HealthSummary {
  /** The masthead's 62px line — mock `health.jsx`'s "All quiet." / "Two faults." */
  headline: string
  /** The italic line under the tally, in the mock's house voice. */
  standfirst: string
  counts: Record<'ok' | 'degraded' | 'critical' | 'unknown', number>
  /** Anything not `ok`, worst first. The first entry becomes the lead story. */
  faults: Service[]
}

const SPELLED = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']

function spell(n: number): string {
  return SPELLED[n] ?? String(n)
}

function bucketOf(status: Status): 'ok' | 'degraded' | 'critical' | 'unknown' {
  if (status === 'ok' || status === 'degraded' || status === 'critical') return status
  return 'unknown'
}

/**
 * Reduces the board to the few things the masthead states.
 *
 * The mock's standfirst is written prose about a specific outage ("The driveway
 * camera has been dark for three hours…"). Nothing here can see *why* a service
 * is unhappy, so this names the ones that are rather than narrating them —
 * saying less beats inventing detail that reads as fact. The house voice and
 * sentence shape are kept; only the invented specifics are dropped.
 */
export function summarizeHealth(services: Service[]): HealthSummary {
  const counts = { ok: 0, degraded: 0, critical: 0, unknown: 0 }
  for (const s of services) counts[bucketOf(s.status)] += 1

  const faults = services
    .filter((s) => bucketOf(s.status) !== 'ok')
    .sort((a, b) => severity(b.status) - severity(a.status))

  if (services.length === 0) {
    return {
      headline: 'Nothing to watch.',
      standfirst: 'No monitors are configured yet.',
      counts,
      faults,
    }
  }

  if (faults.length === 0) {
    return {
      headline: 'All quiet.',
      standfirst: `Everything answering, nothing to report — ${services.length} services, no faults on the board.`,
      counts,
      faults,
    }
  }

  const named = faults
    .slice(0, 3)
    .map((f) => `${f.name} is ${bucketOf(f.status)}`)
    .join(', ')
  const rest = faults.length > 3 ? `, and ${faults.length - 3} more` : ''
  const steady =
    counts.ok > 0 ? ` The other ${counts.ok} ${counts.ok === 1 ? 'is' : 'are'} steady.` : ''

  return {
    headline: `${spell(faults.length)} fault${faults.length === 1 ? '' : 's'}.`,
    standfirst: `${named}${rest}.${steady}`,
    counts,
    faults,
  }
}

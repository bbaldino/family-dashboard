import { describe, it, expect } from 'vitest'
import { summarizeHealth } from './summary'
import type { Service } from './types'

const svc = (name: string, status: Service['status'], message = 'all components ok'): Service => ({
  id: name.length,
  name,
  type_id: 'json-health',
  interval_secs: 10,
  enabled: true,
  status,
  message,
  components: [],
  updated_at: null,
})

describe('summarizeHealth', () => {
  it('says all quiet when nothing is wrong', () => {
    const s = summarizeHealth([svc('Plex', 'ok'), svc('Unraid', 'ok')])

    expect(s.headline).toBe('All quiet.')
    expect(s.standfirst).toContain('2 services')
    expect(s.faults).toHaveLength(0)
  })

  it('counts faults in the headline', () => {
    const s = summarizeHealth([svc('Plex', 'ok'), svc('Frigate', 'critical'), svc('Backups', 'degraded')])

    expect(s.headline).toBe('Two faults.')
  })

  it('uses the singular for one fault', () => {
    const s = summarizeHealth([svc('Plex', 'ok'), svc('Frigate', 'critical')])

    expect(s.headline).toBe('One fault.')
  })

  /** The mock's standfirst is written prose about a specific outage. We can't
   *  write prose, but we can name the services that are actually wrong — which
   *  is the part a reader needs. Inventing narrative detail we can't see would
   *  be worse than saying less. */
  it('names the faulting services rather than describing them', () => {
    const s = summarizeHealth([svc('Plex', 'ok'), svc('Frigate', 'critical'), svc('Backups', 'degraded')])

    expect(s.standfirst).toContain('Frigate')
    expect(s.standfirst).toContain('Backups')
    expect(s.standfirst).toContain('critical')
  })

  /** Worst first: whatever is on fire should lead, and the lead story takes
   *  the first entry. */
  it('orders faults worst first', () => {
    const s = summarizeHealth([svc('Backups', 'degraded'), svc('Frigate', 'critical')])

    expect(s.faults.map((f) => f.name)).toEqual(['Frigate', 'Backups'])
  })

  /** A service we've lost contact with is a fault, not a pass. */
  it('treats unknown as a fault', () => {
    const s = summarizeHealth([svc('Plex', 'ok'), svc('tars', 'unknown')])

    expect(s.headline).toBe('One fault.')
    expect(s.faults.map((f) => f.name)).toEqual(['tars'])
  })

  it('handles having no monitors at all', () => {
    const s = summarizeHealth([])

    expect(s.headline).toBe('Nothing to watch.')
    expect(s.counts.ok).toBe(0)
  })
})

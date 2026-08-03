import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchJson } from './fetchJson'

afterEach(() => vi.unstubAllGlobals())

const respond = (status: number, body: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
      } as Response),
    ),
  )

describe('fetchJson', () => {
  it('returns the parsed body on success', async () => {
    respond(200, [{ monitor_id: 1 }])

    await expect(fetchJson('/api/health/incidents')).resolves.toEqual([{ monitor_id: 1 }])
  })

  /** The bug this exists to prevent: homelab-health v0.3.1 returns 400 for a
   *  malformed window where it used to return `200 []`. Parsed blindly, the
   *  error body — an object — was handed back as if it were the incident array,
   *  and the ledger either threw on `.slice` or drew a clean week over a failed
   *  request. A failure has to reach the caller as a failure. */
  it('throws on an error status instead of parsing the error body as data', async () => {
    respond(400, { error: 'since looks like milliseconds' })

    await expect(fetchJson('/api/health/incidents?since=99999999999')).rejects.toThrow(
      /milliseconds/,
    )
  })

  it('still throws when the error body carries no message', async () => {
    respond(500, {})

    await expect(fetchJson('/api/health/status')).rejects.toThrow(/500/)
  })
})

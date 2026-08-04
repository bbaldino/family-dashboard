import { useQuery } from '@tanstack/react-query'
import type { PlatformIntegration } from './defineIntegration'

export interface IntegrationQueryOptions<Raw, Out> {
  /** Seconds the backend should cache this URL's response. 0 = no caching. */
  ttlSecs?: number
  select?: (raw: Raw) => Out
  /** Number, or a function of the last result — this is the scheduler. */
  refetchInterval?: number | ((data: Out | undefined) => number | false)
  enabled?: boolean
}

/**
 * Fetch a URL through the backend proxy.
 *
 * The integration composes its own URL from its own config. Pass `null` while
 * that config is still loading — the query stays disabled until there is a
 * URL to fetch, which is why there is no separate "config ready" flag.
 */
export function useIntegrationQuery<Raw, Out = Raw>(
  integration: PlatformIntegration,
  url: string | null,
  opts: IntegrationQueryOptions<Raw, Out> = {},
) {
  const { ttlSecs = 0, select, refetchInterval, enabled } = opts

  return useQuery({
    queryKey: ['integration', integration.id, url],
    queryFn: async (): Promise<Raw> => {
      const resp = await fetch('/api/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, ttl_secs: ttlSecs }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error || `${resp.status}`)
      }
      const text = await resp.text()
      return text ? JSON.parse(text) : (undefined as Raw)
    },
    select,
    refetchInterval:
      typeof refetchInterval === 'function'
        ? (q) => {
            // react-query applies `select` only in the observer's derived
            // result — `Query.state.data` here is always the raw, unselected
            // payload (TQueryData defaults to TQueryFnData since we don't
            // pass an explicit generic). Re-derive `select` ourselves so the
            // callback actually receives what its type promises.
            const raw = q.state.data as Raw | undefined
            let value: Out | undefined
            if (raw !== undefined && select) {
              try {
                value = select(raw)
              } catch {
                // In the observer path, react-query catches a throwing
                // `select` itself and the query lands in status: 'error'.
                // This callback runs outside that machinery (it's invoked
                // directly by QueryObserver.setOptions), so a throw here
                // propagates as an uncaught exception with no error
                // boundary on this kiosk — a blank display until someone
                // power-cycles the tablet. Treat a throw as "no data yet"
                // (undefined) rather than hard-stopping the poll: the same
                // callback already has to handle undefined for the
                // pre-first-fetch case, and a later successful fetch can
                // still recover the query without a remount.
                value = undefined
              }
            } else {
              value = raw as unknown as Out | undefined
            }
            return refetchInterval(value)
          }
        : refetchInterval,
    enabled: enabled !== false && url !== null,
  })
}

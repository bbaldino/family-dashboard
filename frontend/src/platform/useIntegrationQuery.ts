import { useQuery } from '@tanstack/react-query'
import { fetchViaProxy, integrationQueryKey, type ProxyFetchSpec } from './proxyFetch'

/**
 * The proxy fields come from `ProxyFetchSpec` rather than being restated
 * here — `url` excepted, because this hook takes it as its own argument so
 * it can accept `null` to mean "config isn't ready".
 *
 * Restating them is how a field gets added to one and silently never reaches
 * the wire from the other: `fetchViaProxy` only forwards what it knows about.
 */
export interface IntegrationQueryOptions<Raw, Out> extends Omit<ProxyFetchSpec, 'url'> {
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
  integration: { id: string },
  url: string | null,
  opts: IntegrationQueryOptions<Raw, Out> = {},
) {
  const { method, headers, body, ttlSecs = 0, expect, select, refetchInterval, enabled } = opts
  const spec = { url, method, headers, body, ttlSecs, expect }

  return useQuery({
    queryKey: integrationQueryKey(integration.id, spec),
    queryFn: () => fetchViaProxy<Raw>(spec),
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

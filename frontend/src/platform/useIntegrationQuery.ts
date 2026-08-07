import { useQuery } from '@tanstack/react-query'
import { fetchViaProxy, integrationQueryKey } from './proxyFetch'

export interface IntegrationQueryOptions<Raw, Out> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
  /** Seconds the backend should cache this URL's response. 0 = no caching. */
  ttlSecs?: number
  /**
   * How the backend should interpret the upstream response. Omitted (the
   * default) means `"json"` — `/api/fetch` parses the body and relays it
   * as-is. `"text"` is for a non-JSON upstream (an HTML page to scrape,
   * say): the backend wraps the raw body as `{ text: string }` instead of
   * attempting to parse it, and `Raw` here is that wrapper shape.
   */
  expect?: 'json' | 'text'
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

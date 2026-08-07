/**
 * The platform's transport: one request through the backend proxy, and the
 * cache key that names it.
 *
 * `useIntegrationQuery` is the usual way in and calls straight through to
 * these. They live outside it, hook-free, for the case a hook can't serve: a
 * dynamic fan-out over N upstreams is N runtime-length queries (`useQueries`),
 * and each of those needs a plain `queryFn` and a `queryKey` rather than a
 * hook it cannot call in a loop. Keying through `integrationQueryKey` is what
 * makes such a caller land on the same cache entry as a `useIntegrationQuery`
 * asking for the same thing, instead of fetching it a second time.
 */

/** One proxied request. Absent fields mean absent — see `fetchViaProxy`. */
export interface ProxyFetchSpec {
  /** `null` is only meaningful to the hook's disabled state; see below. */
  url: string | null
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
  /** Seconds the backend should cache this URL's response. 0 = no caching. */
  ttlSecs?: number
  /** See `IntegrationQueryOptions.expect` — omitted means `"json"`. */
  expect?: 'json' | 'text'
}

/**
 * The cache key a proxied request is stored under.
 *
 * Every field of the spec is in the key because every field changes what
 * comes back — `expect: 'text'` and `expect: 'json'` on one URL are two
 * different payloads, not one entry served twice.
 */
export function integrationQueryKey(integrationId: string, spec: ProxyFetchSpec) {
  const { url, method, headers, body, ttlSecs = 0, expect } = spec
  return ['integration', integrationId, url, method, headers, body, ttlSecs, expect] as const
}

/** Fetch a URL through the backend proxy. Throws on a non-2xx. */
export async function fetchViaProxy<Raw = unknown>(spec: ProxyFetchSpec): Promise<Raw> {
  const { url, method, headers, body, ttlSecs = 0, expect } = spec

  // A plain GET must post exactly `{url, ttl_secs}` — the shape the backend
  // tests assert.
  //
  // The guards below are belt-and-braces, not the mechanism: `JSON.stringify`
  // already drops `undefined`-valued keys, so assigning an absent `method`
  // unguarded would serialise identically. What must not happen is
  // substituting a *default* — `method ?? 'GET'` would put a key on the wire
  // that a plain GET is asserted not to carry. Keep that distinction in mind
  // before "simplifying" either the guards or the defaults.
  const payload: {
    url: string | null
    method?: string
    headers?: Record<string, string>
    body?: unknown
    expect?: string
    ttl_secs: number
  } = { url, ttl_secs: ttlSecs }
  if (method) payload.method = method
  if (headers) payload.headers = headers
  if (body !== undefined) payload.body = body
  if (expect) payload.expect = expect

  const resp = await fetch('/api/fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || `${resp.status}`)
  }
  const text = await resp.text()
  return text ? JSON.parse(text) : (undefined as Raw)
}

/**
 * `fetch` + `json()`, but a failed request fails.
 *
 * The default pairing silently doesn't: `fetch` only rejects on a network
 * error, so a `400` resolves and `.json()` happily parses the error body — the
 * caller then receives `{ error: … }` typed as whatever it asked for. For the
 * ledger that meant an error object standing in for an incident array, which
 * either threw on `.slice` or, worse, could read as a clean week.
 *
 * That path became reachable when homelab-health v0.3.1 started returning 400
 * for a malformed window where it previously returned `200 []`.
 */
export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    const detail = await response
      .json()
      .then((body) => (body && typeof body === 'object' && 'error' in body ? String(body.error) : ''))
      .catch(() => '')
    throw new Error(detail || `${url} failed with ${response.status}`)
  }
  return (await response.json()) as T
}

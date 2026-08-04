import { useQuery } from '@tanstack/react-query'
import type { PlatformIntegration } from './defineIntegration'

export interface IntegrationQueryOptions<Raw, Out> {
  params?: Record<string, string>
  select?: (raw: Raw) => Out
  /** Number, or a function of the last result — this is the scheduler. */
  refetchInterval?: number | ((data: Out | undefined) => number | false)
  enabled?: boolean
}

export function useIntegrationQuery<Raw, Out = Raw>(
  integration: PlatformIntegration,
  endpoint: string,
  opts: IntegrationQueryOptions<Raw, Out> = {},
) {
  const { params, select, refetchInterval, enabled } = opts

  return useQuery({
    queryKey: ['integration', integration.id, endpoint, params ?? {}],
    queryFn: async (): Promise<Raw> => {
      // Params travel in the body. The client never composes a URL — the
      // backend resolves one from its manifest. See the SSRF note in the plan.
      const resp = await fetch(`/api/fetch/${integration.id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params: params ?? {} }),
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
            const value =
              raw !== undefined && select ? select(raw) : (raw as unknown as Out | undefined)
            return refetchInterval(value)
          }
        : refetchInterval,
    enabled,
  })
}

import type { UseQueryResult } from '@tanstack/react-query'
import type { z } from 'zod'
import type { Integration } from '@/data/define-integration'
import { useIntegrationConfig } from '@/data/use-integration-config'
import { useIntegrationQuery } from './useIntegrationQuery'

export interface IntegrationRequest {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
  /** Seconds the backend caches this response. 0 or absent means no caching. */
  ttlSecs?: number
  /** Poll cadence in ms. Put it here when it derives from config. */
  refetchInterval?: number
}

export interface IntegrationDataOptions<Raw, Out> {
  select?: (raw: Raw) => Out
  /** Data-dependent cadence — keeps `useIntegrationQuery`'s meaning. Wins over
   *  `request().refetchInterval` when both are given. */
  refetchInterval?: number | ((data: Out | undefined) => number | false)
  enabled?: boolean
}

/**
 * The one hook a client integration needs.
 *
 * Resolves the integration's config, hands it to `request` typed from that
 * integration's own schema, and keeps the query disabled until config is
 * available — which is why `request` is a callback rather than a value: it
 * must not run against config that has not parsed yet.
 */
export function useIntegrationData<Raw, Out = Raw, T extends z.ZodObject<z.ZodRawShape> = never>(
  integration: Integration<T>,
  request: (cfg: z.infer<T>) => IntegrationRequest,
  opts: IntegrationDataOptions<Raw, Out> = {},
): UseQueryResult<Out> {
  const cfg = useIntegrationConfig(integration)
  const spec = cfg ? request(cfg) : null

  return useIntegrationQuery<Raw, Out>(integration, spec?.url ?? null, {
    method: spec?.method,
    headers: spec?.headers,
    body: spec?.body,
    ttlSecs: spec?.ttlSecs,
    select: opts.select,
    refetchInterval: opts.refetchInterval ?? spec?.refetchInterval,
    enabled: opts.enabled,
  })
}

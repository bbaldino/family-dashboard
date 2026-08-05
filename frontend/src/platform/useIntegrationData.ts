import { useMemo } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { z } from 'zod'
import type { Integration } from '@/data/define-integration'
import { parseIntegrationConfig } from '@/data/use-integration-config'
import { useAllConfig } from '@/data/config/useAllConfig'
import type { PlatformIntegration } from './defineIntegration'
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
 * `integration` is either a config-schema integration
 * (`@/data/define-integration`'s `defineIntegration`) or a schema-less one
 * (`@/platform`'s `defineIntegration`, `{id, name}` only — `daily-quote` is
 * the reference example, ZenQuotes needs no config at all).
 *
 * For the schema-carrying case, `request` is typed `(cfg: z.infer<T>) =>
 * IntegrationRequest` and stays disabled until config is available — this is
 * why `request` is a callback rather than a value, so it never runs against
 * config that has not parsed yet. For the schema-less case there is nothing
 * to wait on, so pass a zero-argument `request`; a function that ignores its
 * (unused, `never`-typed) parameter satisfies the same declared type, which
 * is why this is one signature rather than two overloads — overloads on a
 * generic function like this block contextual typing of `request`'s
 * parameter at every call site that doesn't spell out `<Raw, Out, T>`
 * explicitly, which is most of them.
 *
 * Internally this always calls `useAllConfig` — same hook, same order, every
 * render, required either way — but disables it (`enabled: hasSchema`) for
 * the schema-less case, so a schema-less integration never touches
 * `/api/config` at all rather than merely declining to wait on it.
 * `hasSchema` is fixed for a given call site (it comes from which
 * `defineIntegration` produced the object passed in) and never flips
 * between renders, so branching on it is safe despite looking conditional.
 */
export function useIntegrationData<Raw, Out = Raw, T extends z.ZodObject<z.ZodRawShape> = never>(
  integration: Integration<T> | PlatformIntegration,
  request: (cfg: z.infer<T>) => IntegrationRequest,
  opts: IntegrationDataOptions<Raw, Out> = {},
): UseQueryResult<Out> {
  const hasSchema = 'schema' in integration

  const { data: rawConfig } = useAllConfig({ enabled: hasSchema })

  const cfg = useMemo(
    () => (hasSchema ? parseIntegrationConfig(integration as Integration<T>, rawConfig) : null),
    [hasSchema, integration, rawConfig],
  )

  const spec = hasSchema
    ? cfg
      ? request(cfg)
      : null
    : // Schema-less: nothing to gate on, run immediately. `request` here is
      // really a zero-arg builder — see the doc comment above — so the
      // argument is never read.
      request(undefined as z.infer<T>)

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

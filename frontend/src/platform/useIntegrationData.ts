import { useMemo } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { z } from 'zod'
import type { Integration } from './defineIntegration'
import { parseIntegrationConfig } from './useIntegrationConfig'
import { useAllConfig } from './useAllConfig'
import { useIntegrationQuery } from './useIntegrationQuery'

export interface IntegrationRequest {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
  /** Seconds the backend caches this response. 0 or absent means no caching. */
  ttlSecs?: number
  /** See `IntegrationQueryOptions.expect` — omitted means `"json"`. */
  expect?: 'json' | 'text'
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
 * `integration` is always a `defineIntegration` result, `schema` and
 * `fields` included — a config-less integration (`word-of-the-day` is the
 * reference example, it needs no config at all) declares that by
 * giving `schema: z.object({})`, not by omitting `schema`. Whether there is
 * anything to wait on is derived from the schema itself (`hasConfig` below),
 * not from which function produced the object.
 *
 * For the schema-carrying case, `request` is typed `(cfg: z.infer<T>) =>
 * IntegrationRequest` and stays disabled until config is available — this is
 * why `request` is a callback rather than a value, so it never runs against
 * config that has not parsed yet. For the config-less case there is nothing
 * to wait on, so pass a zero-argument `request`; a function that ignores its
 * (unused, `{}`-typed) parameter satisfies the same declared type, which is
 * why this is one signature rather than two overloads — overloads on a
 * generic function like this block contextual typing of `request`'s
 * parameter at every call site that doesn't spell out `<Raw, Out, T>`
 * explicitly, which is most of them.
 *
 * Internally this always calls `useAllConfig` — same hook, same order, every
 * render, required either way — but disables it (`enabled: hasConfig`) for
 * the config-less case, so a config-less integration never touches
 * `/api/config` at all rather than merely declining to wait on it.
 * `hasConfig` is fixed for a given call site (it comes from the integration's
 * own schema) and never flips between renders, so branching on it is safe
 * despite looking conditional.
 */
export function useIntegrationData<
  Raw,
  Out = Raw,
  T extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
>(
  integration: Integration<T>,
  request: (cfg: z.infer<T>) => IntegrationRequest,
  opts: IntegrationDataOptions<Raw, Out> = {},
): UseQueryResult<Out> {
  const hasConfig = Object.keys(integration.schema.shape).length > 0

  const { data: rawConfig } = useAllConfig({ enabled: hasConfig })

  const cfg = useMemo(
    () => (hasConfig ? parseIntegrationConfig(integration, rawConfig) : ({} as z.infer<T>)),
    [hasConfig, integration, rawConfig],
  )

  const spec = hasConfig
    ? cfg
      ? request(cfg)
      : null
    : // Config-less: nothing to gate on, run immediately. `request` here is
      // really a zero-arg builder — see the doc comment above — so the
      // argument (an empty object, not a parsed config) is never read.
      request({} as z.infer<T>)

  return useIntegrationQuery<Raw, Out>(integration, spec?.url ?? null, {
    method: spec?.method,
    headers: spec?.headers,
    body: spec?.body,
    ttlSecs: spec?.ttlSecs,
    expect: spec?.expect,
    select: opts.select,
    refetchInterval: opts.refetchInterval ?? spec?.refetchInterval,
    enabled: opts.enabled,
  })
}

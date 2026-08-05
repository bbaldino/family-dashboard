import { useMemo } from 'react'
import { z } from 'zod'
import type { Integration } from '@/data/define-integration'
import { useAllConfig } from '@/data/config/useAllConfig'

/**
 * Scope raw `/api/config` data by an integration's id prefix and validate it
 * against that integration's schema. Split out of `useIntegrationConfig` so
 * `useIntegrationData` can reuse the exact same parsing behaviour for its
 * schema-carrying case, rather than a second implementation that could drift
 * from this one.
 */
export function parseIntegrationConfig<T extends z.ZodObject<z.ZodRawShape>>(
  integration: Integration<T>,
  data: Record<string, string> | undefined,
): z.infer<T> | null {
  if (!data) return null
  const prefix = integration.id + '.'
  const scoped: Record<string, string> = {}
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith(prefix)) scoped[key.slice(prefix.length)] = value
  }
  const result = integration.schema.safeParse(scoped)
  if (!result.success) {
    // A misconfigured integration used to be indistinguishable from an
    // unconfigured one: this returned null, and callers render nothing for
    // null. That is how a dead `music.service_url` presented as "music was
    // never set up". Returning null is still correct (callers depend on it),
    // but the reason is no longer invisible.
    const where = result.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ')
    console.error(`config: ${integration.id} is misconfigured — ${where}`)
    return null
  }
  return result.data
}

/**
 * This integration's config, scoped and validated.
 *
 * Signature is unchanged from the pre-react-query version — 7 call sites depend
 * on `z.infer<T> | null` — but the fetch is now shared (see `useAllConfig`).
 */
export function useIntegrationConfig<T extends z.ZodObject<z.ZodRawShape>>(
  integration: Integration<T>,
): z.infer<T> | null {
  const { data } = useAllConfig()

  return useMemo(() => parseIntegrationConfig(integration, data), [data, integration])
}

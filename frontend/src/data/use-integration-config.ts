import { useMemo } from 'react'
import { z } from 'zod'
import type { Integration } from '@/data/define-integration'
import { useAllConfig } from '@/data/config/useAllConfig'

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

  return useMemo(() => {
    if (!data) return null
    const prefix = integration.id + '.'
    const scoped: Record<string, string> = {}
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith(prefix)) scoped[key.slice(prefix.length)] = value
    }
    const result = integration.schema.safeParse(scoped)
    return result.success ? result.data : null
  }, [data, integration])
}

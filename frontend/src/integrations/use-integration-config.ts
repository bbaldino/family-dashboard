import { useState, useEffect } from 'react'
import { z } from 'zod'
import type { Integration } from './define-integration'

export function useIntegrationConfig<T extends z.ZodObject<z.ZodRawShape>>(
  integration: Integration<T>,
): z.infer<T> | null {
  const [config, setConfig] = useState<z.infer<T> | null>(null)

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((allConfig: Record<string, string>) => {
        const prefix = integration.id + '.'
        const scoped: Record<string, string> = {}
        for (const [key, value] of Object.entries(allConfig)) {
          if (key.startsWith(prefix)) {
            scoped[key.slice(prefix.length)] = value
          }
        }
        const result = integration.schema.safeParse(scoped)
        setConfig(result.success ? result.data : null)
      })
      .catch(() => setConfig(null))
  }, [integration.id, integration.schema])

  return config
}

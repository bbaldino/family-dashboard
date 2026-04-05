import type { WidgetMeta } from '@/lib/widget-types'
import { useIntegrationConfig } from '@/integrations/use-integration-config'
import { wordOfTheDayIntegration } from './config'

export function useWordOfTheDayWidgetMeta(): WidgetMeta {
  const config = useIntegrationConfig(wordOfTheDayIntegration)
  const hasKey = !!config?.api_key

  if (!hasKey) {
    return { visible: false }
  }

  return { visible: true, preferredSize: 'standard', priority: 0 }
}

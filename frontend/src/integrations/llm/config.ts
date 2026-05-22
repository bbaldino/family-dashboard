import { z } from 'zod'
import { defineIntegration } from '../define-integration'
import { LlmSettings } from './LlmSettings'

export const llmIntegration = defineIntegration({
  id: 'llm',
  name: 'LLM',
  hasBackend: false,
  schema: z.object({
    provider: z.string().optional().default('ollama'),
    url: z.string().optional().default(''),
  }),
  // Fields are required by the type but not rendered — settingsComponent owns the UI.
  fields: {
    provider: { label: 'Provider' },
    url: { label: 'Service URL' },
  },
  settingsComponent: LlmSettings,
})

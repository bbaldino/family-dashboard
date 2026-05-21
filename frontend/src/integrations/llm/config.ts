import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const llmIntegration = defineIntegration({
  id: 'llm',
  name: 'LLM',
  hasBackend: false,
  schema: z.object({
    provider: z.string().optional().default('ollama'),
    url: z.string().optional().default(''),
  }),
  fields: {
    provider: {
      label: 'Provider',
      description: '"ollama" (default — uses the Ollama integration config) or "openai_compat"',
    },
    url: {
      label: 'Service URL',
      description: 'Base URL for openai_compat provider (e.g. http://localhost:8080). Ignored when provider is "ollama".',
    },
  },
})

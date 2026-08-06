import { z } from 'zod'
import { defineIntegration } from '@/platform'

export const llmProvider = defineIntegration({
  id: 'llm',
  name: 'LLM',
  schema: z.object({
    url: z.string().optional().default(''),
  }),
  fields: {
    url: {
      label: 'Service URL',
      description: 'Base URL of the openai-compatible chat-completions service.',
    },
  },
})

import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const onThisDayIntegration = defineIntegration({
  id: 'on-this-day',
  name: 'On This Day',
  schema: z.object({
    ollama_url: z.string().optional().default('http://localhost:11434'),
  }),
  fields: {
    ollama_url: {
      label: 'Ollama URL',
      description: 'URL for Ollama API (for content filtering)',
    },
  },
})

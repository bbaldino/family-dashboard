import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const onThisDayIntegration = defineIntegration({
  id: 'on-this-day',
  name: 'On This Day',
  schema: z.object({
    ollama_model: z.string().optional().default('llama3.2:3b'),
  }),
  fields: {
    ollama_model: { label: 'Ollama Model', type: 'ollama-model', description: 'Model for content filtering' },
  },
})

import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const ollamaIntegration = defineIntegration({
  id: 'ollama',
  name: 'Ollama',
  hasBackend: false,
  schema: z.object({
    url: z.string().optional().default('http://localhost:11434'),
    token: z.string().optional(),
  }),
  fields: {
    url: { label: 'Ollama URL', description: 'e.g. http://192.168.1.100:11434' },
    token: { label: 'API Token', type: 'secret', description: 'Optional bearer token for authentication' },
  },
})

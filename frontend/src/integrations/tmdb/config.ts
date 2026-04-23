import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const tmdbIntegration = defineIntegration({
  id: 'tmdb',
  name: 'TMDB',
  hasBackend: false,
  schema: z.object({
    api_key: z.string().optional(),
  }),
  fields: {
    api_key: { label: 'API Key', description: 'API key from themoviedb.org' },
  },
})

import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const wordOfTheDayIntegration = defineIntegration({
  id: 'word-of-the-day',
  name: 'Word of the Day',
  schema: z.object({
    api_key: z.string().min(1, 'Wordnik API key is required'),
  }),
  fields: {
    api_key: { label: 'Wordnik API Key', type: 'secret', description: 'Free key from developer.wordnik.com' },
  },
})

import { z } from 'zod'
import { defineIntegration } from '@/data/define-integration'

export const wordOfTheDayIntegration = defineIntegration({
  id: 'word-of-the-day',
  name: 'Word of the Day',
  schema: z.object({}),
  fields: {},
})

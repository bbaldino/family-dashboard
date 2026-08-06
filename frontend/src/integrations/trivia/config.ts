import { z } from 'zod'
import { defineIntegration } from '@/platform'

export const triviaIntegration = defineIntegration({
  id: 'trivia',
  name: 'Trivia',
  schema: z.object({}),
  fields: {},
})

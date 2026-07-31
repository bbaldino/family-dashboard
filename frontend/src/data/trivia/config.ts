import { z } from 'zod'
import { defineIntegration } from '@/integrations/define-integration'

export const triviaIntegration = defineIntegration({
  id: 'trivia',
  name: 'Trivia',
  schema: z.object({}),
  fields: {},
})

import { z } from 'zod'
import { defineIntegration } from '@/integrations/define-integration'

export const jokesIntegration = defineIntegration({
  id: 'jokes',
  name: 'Joke of the Day',
  schema: z.object({}),
  fields: {},
})

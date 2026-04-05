import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const dailyQuoteIntegration = defineIntegration({
  id: 'daily-quote',
  name: 'Daily Quote',
  schema: z.object({}),
  fields: {},
})

import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const onThisDayIntegration = defineIntegration({
  id: 'on-this-day',
  name: 'On This Day',
  schema: z.object({}),
  fields: {},
})

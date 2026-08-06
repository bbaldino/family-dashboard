import { z } from 'zod'
import { defineIntegration } from '@/platform'

export const choresIntegration = defineIntegration({
  id: 'chores',
  name: 'Chores',
  schema: z.object({}),
  fields: {},
})

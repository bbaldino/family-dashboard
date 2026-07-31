import { z } from 'zod'
import { defineIntegration } from '@/data/define-integration'

export const choresIntegration = defineIntegration({
  id: 'chores',
  name: 'Chores',
  schema: z.object({}),
  fields: {},
})

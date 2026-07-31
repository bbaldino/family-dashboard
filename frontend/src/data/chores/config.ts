import { z } from 'zod'
import { defineIntegration } from '@/integrations/define-integration'

export const choresIntegration = defineIntegration({
  id: 'chores',
  name: 'Chores',
  schema: z.object({}),
  fields: {},
})

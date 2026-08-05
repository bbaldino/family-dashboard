import { z } from 'zod'
import { defineIntegration } from '@/platform'

export const themeIntegration = defineIntegration({
  id: 'theme',
  name: 'Theme',
  schema: z.object({}),
  fields: {},
})

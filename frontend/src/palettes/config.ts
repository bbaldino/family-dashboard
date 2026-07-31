import { z } from 'zod'
import { defineIntegration } from '@/data/define-integration'

export const themeIntegration = defineIntegration({
  id: 'theme',
  name: 'Theme',
  hasBackend: false,
  schema: z.object({}),
  fields: {},
})

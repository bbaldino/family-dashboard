import { z } from 'zod'
import { defineIntegration } from '@/platform'

export const dashboardIntegration = defineIntegration({
  id: 'dashboard',
  name: 'Dashboard',
  schema: z.object({}),
  fields: {},
})

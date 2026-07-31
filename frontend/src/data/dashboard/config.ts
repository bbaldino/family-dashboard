import { z } from 'zod'
import { defineIntegration } from '@/data/define-integration'

export const dashboardIntegration = defineIntegration({
  id: 'dashboard',
  name: 'Dashboard',
  hasBackend: false,
  schema: z.object({}),
  fields: {},
})

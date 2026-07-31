import { z } from 'zod'
import { defineIntegration } from '@/integrations/define-integration'

export const dashboardIntegration = defineIntegration({
  id: 'dashboard',
  name: 'Dashboard',
  hasBackend: false,
  schema: z.object({}),
  fields: {},
})

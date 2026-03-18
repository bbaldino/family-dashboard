import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const packagesIntegration = defineIntegration({
  id: 'packages',
  name: 'Packages',
  schema: z.object({
    service_url: z.string().optional().default('http://localhost:4000/api/ext/packages'),
  }),
  fields: {
    service_url: {
      label: 'Packages Service URL',
      description: 'Base URL of the packages tracking service',
    },
  },
})

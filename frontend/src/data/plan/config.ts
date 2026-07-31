import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const planIntegration = defineIntegration({
  id: 'plan',
  name: 'PLAN',
  hasBackend: false,
  schema: z.object({
    service_url: z.string().optional().default('http://localhost:4000'),
  }),
  fields: {
    service_url: { label: 'PLAN Service URL', description: 'URL of the PLAN service' },
  },
})

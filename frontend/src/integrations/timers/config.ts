import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const timersIntegration = defineIntegration({
  id: 'timers',
  name: 'Timers',
  hasBackend: false,
  schema: z.object({
    service_url: z.string().optional(),
  }),
  fields: {
    service_url: {
      label: 'Timer Service URL',
      description: 'e.g. http://192.168.1.21:3380/timers',
    },
  },
})

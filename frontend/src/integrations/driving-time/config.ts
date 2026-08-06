import { z } from 'zod'
import { defineIntegration } from '@/platform'

export const drivingTimeIntegration = defineIntegration({
  id: 'driving-time',
  name: 'Driving Time',
  schema: z.object({
    home_address: z.string().min(1, 'Home address is required'),
    buffer_minutes: z.coerce.number().int().nonnegative().default(5),
  }),
  fields: {
    home_address: {
      label: 'Home Address',
      description: 'Your home address for driving time calculations',
    },
    buffer_minutes: {
      label: 'Buffer Minutes',
      description: 'Extra minutes to add before leave-by time',
    },
  },
})

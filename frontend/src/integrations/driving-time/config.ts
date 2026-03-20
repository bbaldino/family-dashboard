import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const drivingTimeIntegration = defineIntegration({
  id: 'driving-time',
  name: 'Driving Time',
  schema: z.object({
    home_address: z.string().optional(),
    buffer_minutes: z.string().optional().default('5'),
  }),
  fields: {
    home_address: { label: 'Home Address', description: 'Your home address for driving time calculations' },
    buffer_minutes: { label: 'Buffer Minutes', description: 'Extra minutes to add before leave-by time' },
  },
})

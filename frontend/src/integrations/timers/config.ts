import { z } from 'zod'
import { defineIntegration } from '@/platform'

export const timersIntegration = defineIntegration({
  id: 'timers',
  name: 'Timers',
  schema: z.object({
    service_url: z.string().optional(),
    alarm_sound: z.string().optional(),
  }),
  fields: {
    service_url: {
      label: 'Timer Service URL',
      description: 'e.g. http://192.168.1.21:3380/timers',
    },
    alarm_sound: {
      label: 'Alarm Sound',
    },
  },
})

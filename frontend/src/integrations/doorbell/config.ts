import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const doorbellIntegration = defineIntegration({
  id: 'doorbell',
  name: 'Doorbell Camera',
  schema: z.object({
    go2rtc_url: z.string().min(1, 'go2rtc URL is required'),
    stream_name: z.string().min(1, 'Stream name is required'),
  }),
  fields: {
    go2rtc_url: {
      label: 'go2rtc URL',
      description: 'e.g. http://frigate:1984',
    },
    stream_name: {
      label: 'Stream name',
      description: 'e.g. doorbell',
    },
  },
})

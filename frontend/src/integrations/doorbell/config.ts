import { z } from 'zod'
import { defineIntegration } from '../define-integration'
import { DoorbellSettings } from './DoorbellSettings'

export const doorbellIntegration = defineIntegration({
  id: 'doorbell',
  name: 'Doorbell Camera',
  hasBackend: false,
  schema: z.object({
    go2rtc_url: z.string().optional(),
    stream_name: z.string().optional(),
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
  settingsComponent: DoorbellSettings,
})

import { z } from 'zod'
import { defineIntegration } from '../define-integration'
import { DoorbellSettings } from './DoorbellSettings'

export const doorbellIntegration = defineIntegration({
  id: 'doorbell',
  name: 'Doorbell Camera',
  hasBackend: false,
  schema: z.object({
    camera_url: z.string().optional(),
  }),
  fields: {
    camera_url: {
      label: 'Camera Page URL',
      description: 'WebRTC camera page URL (e.g. https://cast.baldino.me/webrtc-doorbell.html)',
    },
  },
  settingsComponent: DoorbellSettings,
})

import { z } from 'zod'
import { defineIntegration } from '@/data/define-integration'

export const doorbellIntegration = defineIntegration({
  id: 'doorbell',
  name: 'Doorbell Camera',
  hasBackend: false,
  schema: z.object({
    camera_url: z.string().optional().default('https://cast.baldino.me/webrtc-doorbell.html'),
    press_sensor_entity: z.string().default('binary_sensor.frontdoordoorbell_visitor'),
    screensaver_entity: z.string().default('switch.kitchen_kitchen_dashboard_screensaver'),
    auto_dismiss_seconds: z.number().int().min(0).default(60),
    chime_enabled: z.boolean().default(true),
    chime_sound_id: z.string().default('soft-doorbell'),
  }),
  fields: {
    camera_url: {
      label: 'Camera Page URL',
      description: 'WebRTC camera page URL (e.g. https://cast.baldino.me/webrtc-doorbell.html)',
    },
    press_sensor_entity: {
      label: 'Press Sensor Entity',
      description: 'HA binary_sensor entity that flips on when the doorbell is pressed.',
    },
    screensaver_entity: {
      label: 'Screensaver Entity',
      description:
        'HA switch entity for the tablet screensaver. When on, popups are skipped. Empty disables the check.',
    },
    auto_dismiss_seconds: {
      label: 'Auto-dismiss (seconds)',
      description: 'How long the popup stays open before closing itself. 0 = never auto-close.',
    },
    chime_enabled: {
      label: 'Play Chime',
      type: 'boolean',
      description: 'Play a chime when the popup opens.',
    },
    chime_sound_id: {
      label: 'Chime Sound',
      description: 'Selected chime from the built-in sound catalog.',
    },
  },
})

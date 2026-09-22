import { z } from 'zod'
import { defineIntegration } from '@/platform'

function parseStoredBoolean(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  if (normalized === '') return undefined
  return value
}

export const camerasIntegration = defineIntegration({
  id: 'cameras',
  name: 'Cameras',
  // Only the doorbell's live-view + ring-popup config lives in the runtime
  // schema. The Frigate recordings keys (cameras.frigate_url, min_score, …) are
  // read by the backend and the Today-tab fetch, never here — keeping them out
  // of this schema means a bad recordings value can't null the whole
  // integration and kill the live camera + ring popup.
  schema: z.object({
    doorbell_live_url: z
      .string()
      .optional()
      .default('https://cast.baldino.me/webrtc-doorbell.html'),
    doorbell_press_sensor: z.string().default('binary_sensor.frontdoordoorbell_visitor'),
    doorbell_screensaver_entity: z.string().default('switch.kitchen_kitchen_dashboard_screensaver'),
    doorbell_auto_dismiss_seconds: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.coerce.number().int().min(0).default(60),
    ),
    doorbell_chime_enabled: z.preprocess(parseStoredBoolean, z.boolean().default(true)),
    doorbell_chime_sound_id: z.string().default('soft-doorbell'),
  }),
  fields: {
    doorbell_live_url: {
      label: 'Camera Page URL',
      description: 'WebRTC camera page URL (e.g. https://cast.baldino.me/webrtc-doorbell.html)',
    },
    doorbell_press_sensor: {
      label: 'Press Sensor Entity',
      description: 'HA binary_sensor entity that flips on when the doorbell is pressed.',
    },
    doorbell_screensaver_entity: {
      label: 'Screensaver Entity',
      description:
        'HA switch entity for the tablet screensaver. When on, popups are skipped. Empty disables the check.',
    },
    doorbell_auto_dismiss_seconds: {
      label: 'Auto-dismiss (seconds)',
      description: 'How long the popup stays open before closing itself. 0 = never auto-close.',
    },
    doorbell_chime_enabled: {
      label: 'Play Chime',
      type: 'boolean',
      description: 'Play a chime when the popup opens.',
    },
    doorbell_chime_sound_id: {
      label: 'Chime Sound',
      description: 'Selected chime from the built-in sound catalog.',
    },
  },
})

import { z } from 'zod'
import { defineIntegration } from '@/platform'

/**
 * Parse `"true"`/`"false"` as the config table (and `CamerasSettings`' own
 * `String(chimeEnabled)`) writes them.
 *
 * `z.coerce.boolean()` is emphatically **not** the tool for this: it runs
 * JavaScript's `Boolean()`, under which the string `"false"` is truthy — so a
 * chime explicitly switched off would read as on. A blank value falls through
 * to `undefined` so the schema default applies, matching `driving-time`'s
 * cleared-field handling. Anything else is left alone for `z.boolean()` to
 * reject loudly rather than guessed at.
 */
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
    // Every value in the config table is TEXT, and `CamerasSettings` writes
    // these two as `"60"` and `"true"` — so a plain `z.number()`/`z.boolean()`
    // here fails to parse the moment that form is ever saved, and
    // `useIntegrationConfig` returns `null` for the *whole* integration on any
    // parse failure. The live camera and the ring popup would both go dead.
    // Same shape as `driving-time`'s `buffer_minutes`, blank-string case
    // included: `.default()` sits on the inner schema, because `ZodDefault`
    // only substitutes for `undefined` at the node it is attached to.
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

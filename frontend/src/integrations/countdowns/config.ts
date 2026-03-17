import { z } from 'zod'
import { defineIntegration } from '../define-integration'
import { CountdownsSettings } from './CountdownsSettings'

export const countdownsIntegration = defineIntegration({
  id: 'countdowns',
  name: 'Countdowns',
  hasBackend: false,
  schema: z.object({
    calendar_id: z.string().min(1, 'Calendar ID is required'),
    horizon_days: z.string().optional().default('90'),
  }),
  fields: {
    calendar_id: { label: 'Google Calendar ID' },
    horizon_days: { label: 'Days ahead' },
  },
  settingsComponent: CountdownsSettings,
})

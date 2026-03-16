import { z } from 'zod'
import { defineIntegration } from '../define-integration'
import { GoogleCalendarSettings } from './GoogleCalendarSettings'

export const googleCalendarIntegration = defineIntegration({
  id: 'google-calendar',
  name: 'Google Calendar',
  schema: z.object({
    client_id: z.string().min(1, 'Client ID is required'),
    client_secret: z.string().min(1, 'Client Secret is required'),
    redirect_uri: z.string().min(1, 'Redirect URI is required'),
    calendar_ids: z.string().optional(),
  }),
  fields: {
    client_id: { label: 'Google Client ID', type: 'secret' },
    client_secret: { label: 'Google Client Secret', type: 'secret' },
    redirect_uri: { label: 'Redirect URI' },
    calendar_ids: {
      label: 'Selected Calendars (JSON)',
      description: 'Managed via calendar picker below',
    },
  },
  settingsComponent: GoogleCalendarSettings,
})

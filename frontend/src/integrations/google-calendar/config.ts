import { z } from 'zod'
import { defineIntegration } from '../define-integration'
import { GoogleCalendarSettings } from './GoogleCalendarSettings'

export const googleCalendarIntegration = defineIntegration({
  id: 'google-calendar',
  name: 'Google Calendar',
  schema: z.object({
    calendar_ids: z.string().optional(),
  }),
  fields: {
    calendar_ids: {
      label: 'Selected Calendars (JSON)',
      description: 'Managed via calendar picker below',
    },
  },
  settingsComponent: GoogleCalendarSettings,
})

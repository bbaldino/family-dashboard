import { z } from 'zod'
import { defineIntegration } from '../define-integration'
import { MusicSettings } from './MusicSettings'

export const musicIntegration = defineIntegration({
  id: 'music',
  name: 'Music',
  schema: z.object({
    service_url: z.string().optional(),
    api_token: z.string().optional(),
    default_player: z.string().optional(),
  }),
  fields: {
    service_url: { label: 'Music Assistant URL', description: 'e.g. http://192.168.1.42:8095' },
    api_token: { label: 'API Token', type: 'secret' },
    default_player: { label: 'Default Player ID', description: 'Player ID for default playback target' },
  },
  settingsComponent: MusicSettings,
})

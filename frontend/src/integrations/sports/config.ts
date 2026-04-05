import { z } from 'zod'
import { defineIntegration } from '../define-integration'
import { SportsSettings } from './SportsSettings'

export const sportsIntegration = defineIntegration({
  id: 'sports',
  name: 'Sports',
  schema: z.object({
    tracked_teams: z.string().optional().default('[]'),
    poll_interval_live: z.string().optional().default('30'),
    poll_interval_idle: z.string().optional().default('900'),
    window_hours: z.string().optional().default('24'),
    ollama_model: z.string().optional().default('llama3.1:8b'),
  }),
  fields: {
    tracked_teams: { label: 'Tracked Teams', description: 'JSON array of tracked teams' },
    poll_interval_live: { label: 'Live Poll Interval (seconds)', description: 'How often to refresh during live games' },
    poll_interval_idle: { label: 'Idle Poll Interval (seconds)', description: 'How often to refresh when no live games' },
    window_hours: { label: 'Time Window (hours)', description: 'How far back/forward to show games' },
    ollama_model: { label: 'Ollama Model', description: 'Model for AI game previews (e.g. llama3.1:8b)' },
  },
  settingsComponent: SportsSettings,
})

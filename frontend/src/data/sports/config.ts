import { z } from 'zod'
import { defineIntegration } from '@/data/define-integration'

export const sportsIntegration = defineIntegration({
  id: 'sports',
  name: 'Sports',
  schema: z.object({
    tracked_teams: z.string().optional().default('[]'),
    poll_interval_live: z.string().optional().default('5'),
    poll_interval_idle: z.string().optional().default('900'),
    window_hours: z.string().optional().default('24'),
    model: z.string().optional().default('llama3.1:8b'),
  }),
  fields: {
    tracked_teams: { label: 'Tracked Teams', description: 'JSON array of tracked teams' },
    poll_interval_live: { label: 'Live Poll Interval (seconds)', description: 'How often to refresh during live games' },
    poll_interval_idle: { label: 'Idle Poll Interval (seconds)', description: 'How often to refresh when no live games' },
    window_hours: { label: 'Time Window (hours)', description: 'How far back/forward to show games' },
    model: { label: 'Model', type: 'model-select', description: 'Model for AI game previews' },
  },
})

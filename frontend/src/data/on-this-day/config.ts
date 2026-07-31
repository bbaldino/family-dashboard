import { z } from 'zod'
import { defineIntegration } from '@/data/define-integration'

export const onThisDayIntegration = defineIntegration({
  id: 'on-this-day',
  name: 'On This Day',
  schema: z.object({
    model: z.string().optional().default('llama3.2:3b'),
    cycle_minutes: z.string().optional().default('30'),
  }),
  fields: {
    model: { label: 'Model', type: 'model-select', description: 'Model for content filtering' },
    cycle_minutes: { label: 'Cycle Interval (minutes)', description: 'How often to show the next event' },
  },
})

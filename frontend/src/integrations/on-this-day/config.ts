import { z } from 'zod'
import { defineIntegration } from '@/platform'

export const onThisDayIntegration = defineIntegration({
  id: 'on-this-day',
  name: 'On This Day',
  schema: z.object({
    // `llama3.2:3b` was Ollama residue — Ollama is gone from the backend and
    // the LLM is now an openai-compatible service serving haiku/sonnet/opus.
    // The live config already sets this to `haiku`, so nothing deployed
    // changes; this is what a fresh install gets.
    model: z.string().optional().default('haiku'),
    cycle_minutes: z.string().optional().default('30'),
  }),
  fields: {
    model: { label: 'Model', type: 'model-select', description: 'Model for content filtering' },
    cycle_minutes: {
      label: 'Cycle Interval (minutes)',
      description: 'How often to show the next event',
    },
  },
})

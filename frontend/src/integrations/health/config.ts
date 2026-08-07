import { z } from 'zod'
import { defineIntegration } from '@/platform'

/**
 * The Rust proxy (`backend/src/integrations/health/routes.rs`) reads exactly
 * one config value: `config.get_or("base_url", "http://health.home")`. The
 * default here has to match that literal — this schema is the only place the
 * value is settable at all, so a disagreement would show one URL in admin
 * while the backend keeps proxying to the other.
 */
export const healthIntegration = defineIntegration({
  id: 'health',
  name: 'Health',
  schema: z.object({
    base_url: z.string().optional().default('http://health.home'),
  }),
  fields: {
    base_url: {
      label: 'Base URL',
      description: 'homelab-health instance URL, e.g. http://health.home',
    },
  },
})

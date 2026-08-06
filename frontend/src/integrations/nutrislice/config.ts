import { z } from 'zod'
import { defineIntegration } from '@/platform'

/**
 * `defaults` here (`bagby-elementary-school` / `cambriansd` / `lunch`) carry
 * over the deleted Rust route's `config.get_or(...)` fallbacks — the URL
 * builder in `useLunchMenu.ts` no longer applies any defaulting of its own.
 *
 * The `.api` client this integration carries points at `/api/nutrislice`, a
 * route that no longer exists — `useLunchMenu` goes through `/api/fetch`
 * (`useIntegrationData`) instead; nothing here uses `.api`.
 */
export const nutrisliceIntegration = defineIntegration({
  id: 'nutrislice',
  name: 'School Lunch Menu',
  schema: z.object({
    school: z.string().optional().default('bagby-elementary-school'),
    district: z.string().optional().default('cambriansd'),
    menu_type: z.string().optional().default('lunch'),
  }),
  fields: {
    school: { label: 'School slug', description: 'e.g. bagby-elementary-school' },
    district: { label: 'District slug', description: 'e.g. cambriansd' },
    menu_type: { label: 'Menu type', description: 'e.g. lunch' },
  },
})

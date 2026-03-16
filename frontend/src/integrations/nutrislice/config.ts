import { z } from 'zod'
import { defineIntegration } from '../define-integration'

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

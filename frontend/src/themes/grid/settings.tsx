import { z } from 'zod'
import type { ThemeSettings } from '@/shell/types'
import { GridSettingsPanel } from './GridSettingsPanel'

const schema = z.object({
  columns: z.coerce.number().int().min(1).max(24).default(8),
  rows: z.coerce.number().int().min(1).max(24).default(6),
  hidden: z.string().default(''),
})

export const gridSettings: ThemeSettings<typeof schema> = {
  schema,
  fields: {
    columns: { label: 'Grid columns' },
    rows: { label: 'Grid rows' },
    hidden: { label: 'Visible widgets' },
  },
  Component: GridSettingsPanel,
}

import type { ThemeSettings } from '@/shell/types'
import { GridSettingsPanel } from './GridSettingsPanel'
import { gridSettingsSchema, gridSettingsFields } from './settings-declaration'

export const gridSettings: ThemeSettings<typeof gridSettingsSchema> = {
  schema: gridSettingsSchema,
  fields: gridSettingsFields,
  Component: GridSettingsPanel,
}

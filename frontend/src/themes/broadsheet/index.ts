import './broadsheet.css'
import type { ThemeModule } from '@/shell/types'
import { registerTheme } from '@/shell/ThemeRegistry'
import { Home } from './screens/Home'
import { broadsheetCanvas } from './canvas'
import { BroadsheetLayout } from './layout/BroadsheetLayout'

export const broadsheetTheme: ThemeModule = {
  id: 'broadsheet',
  name: 'Broadsheet',
  canvas: broadsheetCanvas,
  layout: BroadsheetLayout,
  screens: {
    home: Home,
  },
  overlays: [],
}

registerTheme(broadsheetTheme)

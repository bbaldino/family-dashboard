import './broadsheet.css'
import type { ThemeModule } from '@/shell/types'
import { registerTheme } from '@/shell/ThemeRegistry'
import { Home } from './screens/Home'
import { Calendar } from './screens/Calendar'
import { Media } from './screens/Media'
import { Album } from './screens/Album'
import { Artist } from './screens/Artist'
import { broadsheetCanvas } from './canvas'
import { BroadsheetLayout } from './layout/BroadsheetLayout'

export const broadsheetTheme: ThemeModule = {
  id: 'broadsheet',
  name: 'Broadsheet',
  canvas: broadsheetCanvas,
  layout: BroadsheetLayout,
  screens: {
    home: Home,
    calendar: Calendar,
    media: Media,
    'media.album': Album,
    'media.artist': Artist,
  },
  overlays: [],
}

registerTheme(broadsheetTheme)

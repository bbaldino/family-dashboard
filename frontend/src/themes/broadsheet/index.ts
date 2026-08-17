import './broadsheet.css'
import type { ThemeModule } from '@/shell/types'
import { DoorbellRingListener } from '@/themes/broadsheet/overlays/doorbell/DoorbellRingListener'
import { registerTheme } from '@/shell/ThemeRegistry'
import { Home } from './screens/Home'
import { Calendar } from './screens/Calendar'
import { Media } from './screens/Media'
import { Album } from './screens/Album'
import { Artist } from './screens/Artist'
import { Sports } from './screens/Sports'
import { Cameras } from './screens/Cameras'
import { Health } from './screens/Health'
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
    sports: Sports,
    cameras: Cameras,
    health: Health,
  },
  overlays: [DoorbellRingListener],
}

registerTheme(broadsheetTheme)

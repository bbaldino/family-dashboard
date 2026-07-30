import type { ThemeModule } from '@/shell/types'
import { registerTheme } from '@/shell/ThemeRegistry'
import { AppShell } from '@/themes/grid/layout/AppShell'
import { HomeBoard } from '@/themes/grid/screens/HomeBoard'
import { CalendarBoard } from '@/themes/grid/screens/calendar/CalendarBoard'
import { MediaBoard } from '@/themes/grid/screens/MediaBoard'
import { ArtistPage } from '@/themes/grid/screens/media/ArtistPage'
import { AlbumPage } from '@/themes/grid/screens/media/AlbumPage'
import { CamerasBoard } from '@/themes/grid/screens/CamerasBoard'
import { HealthBoard } from '@/themes/grid/screens/HealthBoard'
import { gridCanvas } from './canvas'

export const gridTheme: ThemeModule = {
  id: 'grid',
  name: 'Cards Grid',
  canvas: gridCanvas,
  layout: AppShell,
  screens: {
    home: HomeBoard,
    calendar: CalendarBoard,
    media: MediaBoard,
    'media.artist': ArtistPage,
    'media.album': AlbumPage,
    cameras: CamerasBoard,
    health: HealthBoard,
  },
  overlays: [],
}

registerTheme(gridTheme)

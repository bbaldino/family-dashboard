import type { ThemeModule } from '@/shell/types'
import { registerTheme } from '@/shell/ThemeRegistry'
import { AppShell } from '@/app/AppShell'
import { HomeBoard } from '@/boards/HomeBoard'
import { CalendarBoard } from '@/boards/calendar/CalendarBoard'
import { MediaBoard } from '@/boards/MediaBoard'
import { ArtistPage } from '@/boards/media/ArtistPage'
import { AlbumPage } from '@/boards/media/AlbumPage'
import { CamerasBoard } from '@/boards/CamerasBoard'
import { HealthBoard } from '@/boards/HealthBoard'
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

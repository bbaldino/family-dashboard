import { Outlet } from 'react-router-dom'
import { MusicProvider } from '@/data/music'
import { Footer } from '@/themes/broadsheet/home/Footer'

/**
 * The theme's persistent chrome: the 1600x900 editorial canvas that
 * `ScreenShell` scales to the viewport, the current screen filling it via
 * `Outlet`, and the footer nav pinned to the bottom edge on top of it.
 *
 * `MusicProvider` is mounted here rather than at the shell/App level:
 * `GlanceStrip` (rendered by `Home`) calls `useMusic()`, and grid mounts
 * its own `MusicProvider` in `AppShell` for the same reason. Each theme
 * owns the providers its screens need — a shared ancestor would duplicate
 * grid's provider and open two live connections.
 */
export function BroadsheetLayout() {
  return (
    <MusicProvider>
      <div className="broadsheet-root relative w-[1600px] h-[900px] overflow-hidden">
        <Outlet />
        <Footer />
      </div>
    </MusicProvider>
  )
}

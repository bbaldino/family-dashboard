import { Outlet } from 'react-router-dom'
import { MusicProvider } from '@/integrations/music'
import { Footer } from '@/themes/broadsheet/ui/Footer'
import { ActionErrorNotice } from '@/themes/broadsheet/ui/ActionErrorNotice'

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
        {/* Layout-level, not on the Media screen: transport can be driven from
            the footer's own now-playing controls on every screen, so a failure
            has to be reportable from every screen too. */}
        <ActionErrorNotice />
      </div>
    </MusicProvider>
  )
}

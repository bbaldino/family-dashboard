import { Outlet } from 'react-router-dom'
import { Footer } from '@/themes/broadsheet/home/Footer'

/**
 * The theme's persistent chrome: the 1600x900 editorial canvas that
 * `ScreenShell` scales to the viewport, the current screen filling it via
 * `Outlet`, and the footer nav pinned to the bottom edge on top of it.
 */
export function BroadsheetLayout() {
  return (
    <div className="broadsheet-root relative w-[1600px] h-[900px] overflow-hidden">
      <Outlet />
      <Footer />
    </div>
  )
}

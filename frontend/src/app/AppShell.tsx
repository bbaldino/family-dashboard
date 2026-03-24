import { Outlet } from 'react-router-dom'
import { TabBar } from '../ui/TabBar'
import { EventOverlay } from '../ui/EventOverlay'
import { EventBusProvider } from '../lib/event-bus'
import { MusicProvider, MiniPlayer } from '@/integrations/music'

export function AppShell() {
  return (
    <EventBusProvider>
      <MusicProvider>
        <div className="flex flex-col h-screen bg-bg-primary">
          <main className="flex-1 overflow-auto p-[var(--spacing-grid-gap)]">
            <Outlet />
          </main>
          <MiniPlayer />
          <TabBar />
        </div>
        <EventOverlay />
      </MusicProvider>
    </EventBusProvider>
  )
}

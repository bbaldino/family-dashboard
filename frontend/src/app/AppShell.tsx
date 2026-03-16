import { Outlet } from 'react-router-dom'
import { HassConnect } from '@hakit/core'
import { TabBar } from '../ui/TabBar'
import { EventOverlay } from '../ui/EventOverlay'
import { EventBusProvider } from '../lib/event-bus'
import { HA_URL } from '../lib/ha-client'

function Shell() {
  return (
    <EventBusProvider>
      <div className="flex flex-col h-screen bg-bg-primary">
        <main className="flex-1 overflow-auto p-[var(--spacing-grid-gap)]">
          <Outlet />
        </main>
        <TabBar />
      </div>
      <EventOverlay />
    </EventBusProvider>
  )
}

export function AppShell() {
  // Only wrap in HassConnect if HA URL is configured
  if (HA_URL) {
    return (
      <HassConnect hassUrl={HA_URL}>
        <Shell />
      </HassConnect>
    )
  }

  return <Shell />
}

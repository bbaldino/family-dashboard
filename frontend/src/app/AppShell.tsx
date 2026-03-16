import { Outlet } from 'react-router-dom'
import { HassConnect } from '@hakit/core'
import { TabBar } from '../ui/TabBar'
import { HA_URL } from '../lib/ha-client'

export function AppShell() {
  return (
    <HassConnect hassUrl={HA_URL}>
      <div className="flex flex-col h-screen bg-bg-primary">
        <main className="flex-1 overflow-auto p-[var(--spacing-grid-gap)]">
          <Outlet />
        </main>
        <TabBar />
      </div>
    </HassConnect>
  )
}

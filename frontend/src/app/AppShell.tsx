import { Outlet } from 'react-router-dom'
import { TabBar } from '../ui/TabBar'

export function AppShell() {
  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      <main className="flex-1 overflow-auto p-[var(--spacing-grid-gap)]">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}

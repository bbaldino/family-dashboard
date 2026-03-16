import { Routes, Route } from 'react-router-dom'
import { HassConnect } from '@hakit/core'
import { AppShell } from './app/AppShell'
import { HomeBoard } from './boards/HomeBoard'
import { MediaBoard } from './boards/MediaBoard'
import { CamerasBoard } from './boards/CamerasBoard'
import { AdminLayout } from './admin/AdminLayout'
import { ChoreAdmin } from './admin/ChoreAdmin'
import { SettingsAdmin } from './admin/SettingsAdmin'
import { HA_URL, HA_TOKEN } from './lib/ha-client'

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomeBoard />} />
        <Route path="media" element={<MediaBoard />} />
        <Route path="cameras" element={<CamerasBoard />} />
      </Route>
      <Route path="admin" element={<AdminLayout />}>
        <Route path="chores" element={<ChoreAdmin />} />
        <Route path="settings" element={<SettingsAdmin />} />
      </Route>
    </Routes>
  )
}

export function App() {
  if (HA_URL) {
    return (
      <HassConnect hassUrl={HA_URL} hassToken={HA_TOKEN}>
        <AppRoutes />
      </HassConnect>
    )
  }
  return <AppRoutes />
}

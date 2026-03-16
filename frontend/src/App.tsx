import { Routes, Route } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { HomeBoard } from './boards/HomeBoard'
import { MediaBoard } from './boards/MediaBoard'
import { CamerasBoard } from './boards/CamerasBoard'
import { AdminLayout } from './admin/AdminLayout'
import { ChoreAdmin } from './admin/ChoreAdmin'
import { LunchMenuAdmin } from './admin/LunchMenuAdmin'

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomeBoard />} />
        <Route path="media" element={<MediaBoard />} />
        <Route path="cameras" element={<CamerasBoard />} />
      </Route>
      <Route path="admin" element={<AdminLayout />}>
        <Route path="chores" element={<ChoreAdmin />} />
        <Route path="lunch-menu" element={<LunchMenuAdmin />} />
      </Route>
    </Routes>
  )
}

import { Routes, Route } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { HomeBoard } from './boards/HomeBoard'
import { MediaBoard } from './boards/MediaBoard'
import { CamerasBoard } from './boards/CamerasBoard'

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomeBoard />} />
        <Route path="media" element={<MediaBoard />} />
        <Route path="cameras" element={<CamerasBoard />} />
      </Route>
    </Routes>
  )
}

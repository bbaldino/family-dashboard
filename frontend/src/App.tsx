import { Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HassConnect } from '@hakit/core'
import { AppShell } from './app/AppShell'
import { HomeBoard } from './boards/HomeBoard'
import { CalendarBoard } from './boards/calendar/CalendarBoard'
import { MediaBoard } from './boards/MediaBoard'
import { CamerasBoard } from './boards/CamerasBoard'
import { AdminLayout } from './admin/AdminLayout'
import { SettingsAdmin } from './admin/SettingsAdmin'
import { HA_URL, HA_TOKEN } from './lib/ha-client'
import { useTheme } from './theme/useTheme'

function ThemeApplicator() {
  useTheme()
  return null
}

/** Check if HA is reachable before mounting HassConnect */
function useHaReachable(url: string | undefined): boolean {
  const [reachable, setReachable] = useState(false)

  useEffect(() => {
    if (!url) return
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)

    fetch(`${url}/api/`, { signal: controller.signal })
      .then((r) => {
        if (r.ok || r.status === 401) setReachable(true) // 401 = HA is there, just needs auth
      })
      .catch(() => {
        console.warn('HA not reachable, continuing without it')
      })
      .finally(() => clearTimeout(timer))
  }, [url])

  return reachable
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomeBoard />} />
        <Route path="calendar" element={<CalendarBoard />} />
        <Route path="media" element={<MediaBoard />} />
        <Route path="cameras" element={<CamerasBoard />} />
      </Route>
      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<SettingsAdmin />} />
        <Route path="settings" element={<SettingsAdmin />} />
      </Route>
    </Routes>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // Data is fresh for 1 minute
      gcTime: 10 * 60 * 1000, // Keep unused data in cache for 10 minutes
      refetchOnWindowFocus: false, // Tablet stays on one page
      retry: 1,
    },
  },
})

export function App() {
  const content = (
    <QueryClientProvider client={queryClient}>
      <ThemeApplicator />
      <AppRoutes />
    </QueryClientProvider>
  )

  const haReachable = useHaReachable(HA_URL)

  if (HA_URL && haReachable) {
    return (
      <HassConnect hassUrl={HA_URL} hassToken={HA_TOKEN}>
        {content}
      </HassConnect>
    )
  }
  return content
}

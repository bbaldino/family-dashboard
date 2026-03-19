import { Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HassConnect } from '@hakit/core'
import { Component, type ReactNode } from 'react'
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

/** Wraps HassConnect so a connection failure doesn't block the entire app */
class HassErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error: Error) {
    console.warn('HA connection failed, continuing without HA:', error.message)
  }
  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

/** Try HassConnect, but if it takes too long (blocks rendering), skip it */
function HassConnectWithTimeout({ content }: { content: ReactNode }) {
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      console.warn('HA connection timed out after 5s, continuing without HA')
      setTimedOut(true)
    }, 5000)
    return () => clearTimeout(timer)
  }, [])

  if (timedOut) return <>{content}</>

  return (
    <HassErrorBoundary fallback={content}>
      <HassConnect hassUrl={HA_URL!} hassToken={HA_TOKEN}>
        {content}
      </HassConnect>
    </HassErrorBoundary>
  )
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

  if (HA_URL) {
    return <HassConnectWithTimeout content={content} />
  }
  return content
}

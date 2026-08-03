import { Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HassConnect } from '@hakit/core'
import { ThemeMount } from './shell/ThemeMount'
import '@/themes/grid' // side-effect: registers gridTheme
import '@/themes/broadsheet' // side-effect: registers broadsheetTheme
import { AdminLayout } from './admin/AdminLayout'
import { SettingsAdmin } from './admin/SettingsAdmin'
import { getRuntimeConfig } from './lib/ha-client'
import { useHaUsable } from './lib/useHaUsable'
import { useTheme } from './palettes/useTheme'

function PaletteApplicator() {
  useTheme()
  return null
}

/** Fetch HA config from the backend at startup */
function useHaConfig(): { haUrl?: string; haToken?: string; loading: boolean } {
  const [config, setConfig] = useState<{ haUrl?: string; haToken?: string; loading: boolean }>({
    loading: true,
  })

  useEffect(() => {
    getRuntimeConfig().then((rc) => {
      setConfig({
        haUrl: rc.ha_url ?? undefined,
        haToken: rc.ha_token ?? undefined,
        loading: false,
      })
    })
  }, [])

  return config
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/admin/*" element={<AdminLayout />}>
        <Route index element={<SettingsAdmin />} />
        <Route path="settings" element={<SettingsAdmin />} />
      </Route>
      <Route path="/*" element={<ThemeMount />} />
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
  const { haUrl, haToken, loading } = useHaConfig()
  const haUsable = useHaUsable(haUrl, haToken)

  if (loading) return null

  const content = (
    <QueryClientProvider client={queryClient}>
      <PaletteApplicator />
      <AppRoutes />
    </QueryClientProvider>
  )

  if (haUrl && haUsable) {
    return (
      <HassConnect hassUrl={haUrl} hassToken={haToken}>
        {content}
      </HassConnect>
    )
  }
  return content
}

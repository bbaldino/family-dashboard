import { useEffect, useState, Fragment } from 'react'
import { Route, Routes } from 'react-router-dom'
import { getTheme } from './ThemeRegistry'
import type { ScreenKey, ThemeModule } from './types'
import { ROUTE_PATHS } from './routes'
import { ScreenShell } from './canvas/ScreenShell'
import { ScreenErrorBoundary } from './errors/ScreenErrorBoundary'
import { OverlayErrorBoundary } from './errors/OverlayErrorBoundary'
import { ScreenNotAvailable } from './errors/ScreenNotAvailable'
import { useTheme } from '@/palettes/useTheme'
import { themeToVariables } from '@/palettes/types'

const DEFAULT_THEME_ID = 'grid'
const CONFIG_KEY = 'theme.presentation'

function resolveTheme(id: string | null): ThemeModule {
  if (!id) {
    const grid = getTheme(DEFAULT_THEME_ID)
    if (!grid) throw new Error('No default theme registered')
    return grid
  }
  const found = getTheme(id)
  if (found) return found
  console.warn(`Unknown theme "${id}" in config, falling back to ${DEFAULT_THEME_ID}`)
  const grid = getTheme(DEFAULT_THEME_ID)
  if (!grid) throw new Error('No default theme registered')
  return grid
}

export function ThemeMount() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const { activeTheme } = useTheme()

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((config: Record<string, string>) => {
        setActiveId(config[CONFIG_KEY] ?? null)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  if (!loaded) return null

  const theme = resolveTheme(activeId)
  const Layout = theme.layout

  const screenRoutes = (Object.entries(ROUTE_PATHS) as [ScreenKey, string][]).map(([key, path]) => {
    const Component = theme.screens[key]
    return (
      <Route
        key={key}
        path={path}
        element={
          Component ? (
            <ScreenErrorBoundary>
              <Component />
            </ScreenErrorBoundary>
          ) : (
            <ScreenNotAvailable screenKey={key} />
          )
        }
      />
    )
  })

  const routes = (
    <Routes>
      {Layout ? (
        <Route element={<Layout />}>
          {screenRoutes}
          <Route path="*" element={<ScreenNotAvailable screenKey="unknown" />} />
        </Route>
      ) : (
        <>
          {screenRoutes}
          <Route path="*" element={<ScreenNotAvailable screenKey="unknown" />} />
        </>
      )}
    </Routes>
  )

  const content = (
    <Fragment>
      {routes}
      {theme.overlays.map((Overlay, i) => (
        <OverlayErrorBoundary key={i}>
          <Overlay />
        </OverlayErrorBoundary>
      ))}
    </Fragment>
  )

  const rootStyle = Object.fromEntries(Object.entries(themeToVariables(activeTheme.colors)))

  return (
    <div className="w-full h-full" style={rootStyle}>
      {theme.canvas.model === 'fixed-scale' ? (
        <ScreenShell canvas={theme.canvas}>{content}</ScreenShell>
      ) : (
        content
      )}
    </div>
  )
}

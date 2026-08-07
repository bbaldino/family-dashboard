import { Fragment } from 'react'
import { Route, Routes } from 'react-router-dom'
import { useAllConfig } from '@/platform'
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

/**
 * Mounts whichever presentation `theme.presentation` names, in whichever
 * palette `useTheme` resolves.
 *
 * Both come off the one shared `/api/config` query rather than a mount-only
 * fetch of its own, so switching presentation in admin no longer needs a
 * page reload — it lands within that query's poll interval. react-query's
 * structural sharing means an unchanged poll response hands back the same
 * `data` object, so the every-60s refetch re-renders nothing underneath
 * this: the fixed-scale canvas is not remounted and not rescaled.
 */
export function ThemeMount() {
  const { data, isPending } = useAllConfig()
  const { activeTheme } = useTheme()

  // A failed fetch leaves `data` undefined, which resolves to the default
  // theme below — same as the old `.catch` that flipped `loaded` and left
  // the id null.
  if (isPending) return null

  const theme = resolveTheme(data?.[CONFIG_KEY] ?? null)
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

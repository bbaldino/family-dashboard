import { useEffect, useState, type ReactNode } from 'react'
import type { CanvasSpec } from '../types'
import { SmallViewportFallback } from './SmallViewportFallback'

interface Props {
  canvas: Extract<CanvasSpec, { model: 'fixed-scale' }>
  children: ReactNode
}

function currentViewport() {
  return { width: window.innerWidth, height: window.innerHeight }
}

export function ScreenShell({ canvas, children }: Props) {
  const [viewport, setViewport] = useState(currentViewport)

  useEffect(() => {
    const onResize = () => setViewport(currentViewport())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (viewport.width < canvas.minViewportWidth) {
    return (
      <SmallViewportFallback viewportWidth={viewport.width} minWidth={canvas.minViewportWidth} />
    )
  }

  // Fill the viewport in both axes. The canvas keeps its design *width* and
  // scales to the viewport width; its height is whatever fills the remaining
  // viewport height at that scale, so the layout stretches to the screen
  // instead of letterboxing. On a true 16:9 screen (the tablet) the height
  // resolves to the design's 900 and this is identical to the old fit; on any
  // other aspect the fluid height lets the flex layout absorb the difference
  // (the footer stays pinned to the real bottom). `designHeight` remains the
  // reference the theme is authored against.
  const scale = viewport.width / canvas.designWidth
  const canvasHeight = viewport.height / scale

  return (
    <div className="fixed inset-0 bg-bg-primary overflow-hidden">
      <div
        data-testid="theme-canvas"
        style={{
          width: canvas.designWidth,
          height: canvasHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          flexShrink: 0,
        }}
      >
        {children}
      </div>
    </div>
  )
}

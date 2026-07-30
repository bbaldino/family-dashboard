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
    return <SmallViewportFallback viewportWidth={viewport.width} minWidth={canvas.minViewportWidth} />
  }

  const scale = Math.min(
    viewport.width / canvas.designWidth,
    viewport.height / canvas.designHeight,
  )

  return (
    <div className="fixed inset-0 bg-bg-primary flex items-center justify-center overflow-hidden">
      <div
        data-testid="theme-canvas"
        style={{
          width: canvas.designWidth,
          height: canvas.designHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          flexShrink: 0,
        }}
      >
        {children}
      </div>
    </div>
  )
}

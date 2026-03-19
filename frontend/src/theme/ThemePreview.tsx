import { useRef, useState, useEffect } from 'react'
import { themeToVariables } from './types'
import type { ThemeColors } from './types'
import { HomeBoard } from '@/boards/HomeBoard'

interface ThemePreviewProps {
  colors: ThemeColors
}

export function ThemePreview({ colors }: ThemePreviewProps) {
  const vars = themeToVariables(colors)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)

  // Render the dashboard at 2x the container width (for crisp downscale)
  // and use a 16:10 aspect ratio for the viewport
  const [innerWidth, setInnerWidth] = useState(1200)
  const innerHeight = Math.round(innerWidth * 10 / 16)

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth
        // Render at 2x container width for detail, then scale to fit
        const renderWidth = containerWidth * 2
        setInnerWidth(renderWidth)
        setScale(containerWidth / renderWidth)
      }
    }
    updateScale()
    const observer = new ResizeObserver(updateScale)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const scaledHeight = innerHeight * scale

  return (
    <div ref={containerRef} className="w-full" style={{ height: `${scaledHeight}px` }}>
      <div
        className="origin-top-left overflow-hidden rounded-xl border border-border-subtle"
        style={{
          width: `${innerWidth}px`,
          height: `${innerHeight}px`,
          transform: `scale(${scale})`,
          ...Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, v])),
          background: 'var(--color-bg-primary)',
          pointerEvents: 'none',
        }}
      >
        <HomeBoard />
      </div>
    </div>
  )
}

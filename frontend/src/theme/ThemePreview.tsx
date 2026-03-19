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

  // Render the real dashboard at a fixed large size, then scale to fit container
  const innerWidth = 1600
  const innerHeight = 900

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth
        setScale(containerWidth / innerWidth)
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

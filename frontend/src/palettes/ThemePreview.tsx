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

  // The dashboard renders at 1920x1080 internally.
  // We scale it to fit whatever container we're given.
  const innerWidth = 1920
  const innerHeight = 1080

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth
        const containerHeight = containerRef.current.offsetHeight
        if (containerWidth === 0 || containerHeight === 0) return

        // Scale to fit both dimensions
        const scaleX = containerWidth / innerWidth
        const scaleY = containerHeight / innerHeight
        setScale(Math.min(scaleX, scaleY))
      }
    }
    updateScale()
    const observer = new ResizeObserver(updateScale)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <div
        className="absolute top-0 left-0 origin-top-left overflow-hidden rounded-xl border border-border-subtle"
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

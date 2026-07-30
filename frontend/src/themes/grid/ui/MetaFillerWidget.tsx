import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react'
import { RefreshCw } from 'lucide-react'

const CYCLE_INTERVAL_MS = 5 * 60 * 1000
const SWIPE_THRESHOLD = 50

interface FillerEntry {
  key: string
  element: ReactElement
}

interface MetaFillerWidgetProps {
  fillers: FillerEntry[]
}

export function MetaFillerWidget({ fillers }: MetaFillerWidgetProps) {
  const [index, setIndex] = useState(0)
  const [cycleKey, setCycleKey] = useState(0)
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    if (fillers.length <= 1) return
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % fillers.length)
    }, CYCLE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [fillers.length, cycleKey])

  const advance = useCallback(() => {
    if (fillers.length > 0) {
      setIndex((prev) => (prev + 1) % fillers.length)
      setCycleKey((prev) => prev + 1)
    }
  }, [fillers.length])

  const goBack = useCallback(() => {
    if (fillers.length > 0) {
      setIndex((prev) => (prev - 1 + fillers.length) % fillers.length)
      setCycleKey((prev) => prev + 1)
    }
  }, [fillers.length])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const diff = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(diff) < SWIPE_THRESHOLD) return
    if (diff < 0) {
      advance()
    } else {
      goBack()
    }
  }, [advance, goBack])

  if (fillers.length === 0) return null

  const current = fillers[index % fillers.length]

  return (
    <div
      className="relative h-full"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Render the current filler widget (includes its own WidgetCard) */}
      <div key={`${current.key}-${cycleKey}`} className="h-full">
        {current.element}
      </div>
      {/* Cycle controls overlay at bottom-right */}
      {fillers.length > 1 && (
        <div className="absolute bottom-2 right-2 flex items-center gap-2 bg-bg-card/80 backdrop-blur-sm rounded-full px-2 py-1">
          <div className="flex gap-1">
            {fillers.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${
                  i === index % fillers.length ? 'bg-palette-3' : 'bg-border'
                }`}
              />
            ))}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              advance()
            }}
            className="p-0.5 rounded-full text-text-muted hover:text-text-primary transition-colors"
          >
            <RefreshCw size={10} />
          </button>
        </div>
      )}
    </div>
  )
}

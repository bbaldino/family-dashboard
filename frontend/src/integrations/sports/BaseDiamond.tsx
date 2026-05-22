interface BaseDiamondProps {
  onFirst: boolean
  onSecond: boolean
  onThird: boolean
  /** Pixel size of the bounding box; defaults to compact. */
  size?: number
}

export function BaseDiamond({ onFirst, onSecond, onThird, size = 52 }: BaseDiamondProps) {
  const base = Math.round(size * 0.25)
  const baseStyle = (occupied: boolean) =>
    `rotate-45 rounded-[2px] border-2 ${
      occupied ? 'bg-palette-6 border-palette-6' : 'border-border bg-transparent'
    }`
  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: `${size}px`, height: `${Math.round(size * 0.85)}px` }}
    >
      {/* 2nd */}
      <div
        className={`absolute top-0 left-1/2 -translate-x-1/2 ${baseStyle(onSecond)}`}
        style={{ width: base, height: base }}
      />
      {/* 3rd */}
      <div
        className={`absolute top-1/2 left-[2px] -translate-y-1/2 ${baseStyle(onThird)}`}
        style={{ width: base, height: base }}
      />
      {/* 1st */}
      <div
        className={`absolute top-1/2 right-[2px] -translate-y-1/2 ${baseStyle(onFirst)}`}
        style={{ width: base, height: base }}
      />
    </div>
  )
}

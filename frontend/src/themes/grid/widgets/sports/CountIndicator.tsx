interface CountIndicatorProps {
  label: string
  filled: number
  total: number
  /** Tailwind class for the filled dot. */
  color: string
  /** Pixel size of each dot. */
  dotSize?: number
}

export function CountIndicator({ label, filled, total, color, dotSize = 8 }: CountIndicatorProps) {
  return (
    <div className="flex items-center gap-[3px]">
      <span className="text-text-muted text-[11px]">{label}</span>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`rounded-full ${i < filled ? color : 'border border-border'}`}
          style={{ width: dotSize, height: dotSize }}
        />
      ))}
    </div>
  )
}

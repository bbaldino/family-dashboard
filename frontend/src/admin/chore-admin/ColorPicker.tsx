import { useState } from 'react'

const PRESET_COLORS = [
  '#e88a6a', '#6a9aba', '#8a6aba', '#4a8a6a', '#ba6a8a',
  '#c0a030', '#4a7a9a', '#aa5a5a', '#5aaa8a', '#7a7a7a',
]

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [showCustom, setShowCustom] = useState(false)

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {PRESET_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className="w-8 h-8 rounded-full transition-all shrink-0"
          style={{
            backgroundColor: color,
            outline: value === color ? '2px solid white' : 'none',
            outlineOffset: '2px',
            boxShadow: value === color ? `0 0 0 4px ${color}40` : 'none',
          }}
        />
      ))}
      <button
        type="button"
        onClick={() => setShowCustom(!showCustom)}
        className="px-3 py-1.5 text-xs font-medium rounded-full border border-border text-text-secondary hover:bg-bg-card-hover transition-colors"
      >
        Custom
      </button>
      {showCustom && (
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
        />
      )}
    </div>
  )
}

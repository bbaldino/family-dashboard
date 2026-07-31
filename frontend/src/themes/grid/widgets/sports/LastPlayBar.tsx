interface LastPlayBarProps {
  text: string
}

export function LastPlayBar({ text }: LastPlayBarProps) {
  return (
    <div className="mt-3 py-2 px-2.5 bg-palette-6/[0.08] border-l-[3px] border-palette-6 rounded-r">
      <div className="text-[9px] text-palette-6 font-semibold uppercase tracking-[0.5px] mb-0.5">
        Last Play
      </div>
      <div className="text-xs text-text-primary">{text}</div>
    </div>
  )
}

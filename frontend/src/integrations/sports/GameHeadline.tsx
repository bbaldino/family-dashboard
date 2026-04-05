interface GameHeadlineProps {
  text: string
}

export function GameHeadline({ text }: GameHeadlineProps) {
  return (
    <div className="mt-3 pt-2 border-t border-border">
      <div className="text-xs text-text-secondary italic leading-relaxed">{text}</div>
    </div>
  )
}

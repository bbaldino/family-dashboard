import { type ReactNode, useState, useCallback } from 'react'
import { BottomSheet } from './BottomSheet'

type CardCategory = 'calendar' | 'chores' | 'info' | 'food' | 'grocery'

const categoryColors: Record<CardCategory, string> = {
  calendar: 'var(--color-calendar)',
  chores: 'var(--color-chores)',
  info: 'var(--color-info)',
  food: 'var(--color-food)',
  grocery: 'var(--color-grocery)',
}

interface WidgetCardProps {
  title: string
  category: CardCategory
  badge?: string
  detail?: ReactNode
  children: ReactNode
  visible?: boolean
  className?: string
}

export function WidgetCard({
  title, category, badge, detail, children, visible = true, className = '',
}: WidgetCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const color = categoryColors[category]

  const handleTap = useCallback(() => {
    if (detail) setIsExpanded(true)
  }, [detail])

  if (!visible) return null

  return (
    <>
      <div
        className={`bg-bg-card rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-[12px_14px] overflow-hidden flex flex-col ${
          detail ? 'cursor-pointer active:bg-bg-card-hover transition-colors' : ''
        } ${className}`}
        onClick={handleTap}
      >
        <div
          className="flex items-center justify-between mb-[6px] pb-[6px]"
          style={{ borderBottom: '2px solid var(--color-border)' }}
        >
          <span className="text-[13px] font-bold uppercase tracking-[0.6px]" style={{ color }}>
            {title}
          </span>
          {badge && (
            <span
              className="text-[11px] font-semibold px-2 py-[2px] rounded-lg"
              style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}
            >
              {badge}
            </span>
          )}
        </div>
        <div className="flex-1">{children}</div>
      </div>
      {detail && (
        <BottomSheet isOpen={isExpanded} onClose={() => setIsExpanded(false)}>
          {detail}
        </BottomSheet>
      )}
    </>
  )
}

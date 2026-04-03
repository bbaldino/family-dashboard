import { cloneElement } from 'react'
import type { ReactElement } from 'react'
import type { WidgetMeta, WidgetSize } from '@/lib/widget-types'

export interface MagazineWidget {
  key: string
  element: ReactElement
  meta: WidgetMeta
  maxSize?: WidgetSize
}

interface MagazineLayoutProps {
  widgets: MagazineWidget[]
}

interface ResolvedWidget {
  key: string
  element: ReactElement
  size: WidgetSize
}

type LayoutConfig =
  | { type: 'primary'; primary: ResolvedWidget; sidebar: ResolvedWidget[]; shelf: ResolvedWidget[] }
  | { type: 'equal-rows'; widgets: ResolvedWidget[] }

const SIZE_ORDER: WidgetSize[] = ['expanded', 'standard', 'compact']

function capSize(preferred: WidgetSize, max: WidgetSize | undefined): WidgetSize {
  if (!max) return preferred
  const preferredIdx = SIZE_ORDER.indexOf(preferred)
  const maxIdx = SIZE_ORDER.indexOf(max)
  // Higher index = smaller size. Cap means don't go below maxIdx.
  return preferredIdx < maxIdx ? max : preferred
}

function resolveLayout(widgets: MagazineWidget[]): LayoutConfig {
  // Sort by priority descending
  const sorted = [...widgets].sort((a, b) => b.meta.priority - a.meta.priority)

  // Cap preferred sizes at user maxSize
  const capped = sorted.map((w) => ({
    ...w,
    effectivePreferred: capSize(w.meta.preferredSize, w.maxSize),
  }))

  // Check if any widget wants expanded
  const expandedCandidate = capped.find(
    (w) => w.effectivePreferred === 'expanded' && w.meta.supportedSizes.includes('expanded'),
  )

  if (expandedCandidate) {
    const rest = capped.filter((w) => w.key !== expandedCandidate.key)
    const primary: ResolvedWidget = {
      key: expandedCandidate.key,
      element: expandedCandidate.element,
      size: 'expanded',
    }

    // Assign rest to sidebar (compact) and shelf (standard)
    const sidebar: ResolvedWidget[] = []
    const shelf: ResolvedWidget[] = []

    for (const w of rest) {
      if (sidebar.length < 2) {
        sidebar.push({ key: w.key, element: w.element, size: 'compact' })
      } else {
        shelf.push({ key: w.key, element: w.element, size: 'standard' })
      }
    }

    return { type: 'primary', primary, sidebar, shelf }
  }

  // No one wants expanded — equal rows
  return {
    type: 'equal-rows',
    widgets: capped.map((w) => ({
      key: w.key,
      element: w.element,
      size: 'standard',
    })),
  }
}

function renderWithSize(widget: ResolvedWidget): ReactElement {
  return cloneElement(widget.element, { size: widget.size, key: widget.key })
}

export function MagazineLayout({ widgets }: MagazineLayoutProps) {
  if (widgets.length === 0) return null

  const layout = resolveLayout(widgets)

  if (layout.type === 'equal-rows') {
    return (
      <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-[var(--spacing-grid-gap)] min-h-0" style={{ gridAutoFlow: 'dense' }}>
        {layout.widgets.map(renderWithSize)}
      </div>
    )
  }

  const { primary, sidebar, shelf } = layout

  return (
    <div className="flex-1 flex flex-col gap-[var(--spacing-grid-gap)] min-h-0">
      {/* Top: primary + sidebar */}
      <div className="flex gap-[var(--spacing-grid-gap)] min-h-0" style={{ flex: '3 1 0%' }}>
        <div className="flex-[2] min-h-0 overflow-hidden">
          {renderWithSize(primary)}
        </div>
        {sidebar.length > 0 && (
          <div className="flex-1 flex flex-col gap-[var(--spacing-grid-gap)] min-h-0">
            {sidebar.map((w) => (
              <div key={w.key} className="flex-1 min-h-0 overflow-hidden">
                {renderWithSize(w)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom: shelf */}
      {shelf.length > 0 && (
        <div className="flex gap-[var(--spacing-grid-gap)] min-h-0" style={{ flex: '2 1 0%' }}>
          {shelf.map((w) => (
            <div key={w.key} className="flex-1 min-h-0 overflow-hidden">
              {renderWithSize(w)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

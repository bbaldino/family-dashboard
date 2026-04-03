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
  // Filter to visible widgets only
  const visible = widgets.filter((w): w is MagazineWidget & { meta: { visible: true } } => w.meta.visible)

  // Sort by priority descending
  const sorted = [...visible].sort((a, b) => b.meta.priority - a.meta.priority)

  // Cap preferred sizes at user maxSize
  const capped = sorted.map((w) => ({
    ...w,
    effectivePreferred: capSize(w.meta.preferredSize, w.maxSize),
  }))

  // Check if any widget wants expanded
  const expandedCandidate = capped.find(
    (w) => w.effectivePreferred === 'expanded',
  )

  if (expandedCandidate) {
    const rest = capped.filter((w) => w.key !== expandedCandidate.key)
    const primary: ResolvedWidget = {
      key: expandedCandidate.key,
      element: expandedCandidate.element,
      size: 'expanded',
    }

    // Put lowest-priority widgets in sidebar (compact) so higher-priority ones
    // get standard size in the shelf where they have more room
    const shelf: ResolvedWidget[] = []
    const sidebar: ResolvedWidget[] = []
    const sidebarCount = Math.min(2, rest.length)

    for (let i = 0; i < rest.length; i++) {
      const w = rest[i]
      if (i >= rest.length - sidebarCount) {
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
    const count = layout.widgets.length
    const cols = count <= 2 ? count : 3
    const rows = Math.ceil(count / cols)
    return (
      <div
        className="flex-1 grid gap-[var(--spacing-grid-gap)] min-h-0"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gridAutoFlow: 'dense' }}
      >
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

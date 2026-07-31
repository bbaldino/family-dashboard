import type { CanvasSpec } from '@/shell/types'

/**
 * Broadsheet is designed at a fixed 1600×900 editorial canvas and scaled to
 * fit the viewport. Below 800px wide the shell shows SmallViewportFallback
 * instead — the layout's three-column structure has no meaningful phone form.
 */
export const broadsheetCanvas: Extract<CanvasSpec, { model: 'fixed-scale' }> = {
  model: 'fixed-scale',
  designWidth: 1600,
  designHeight: 900,
  minViewportWidth: 800,
}

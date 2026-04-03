export type WidgetSize = 'compact' | 'standard' | 'expanded'

export interface WidgetMeta {
  supportedSizes: WidgetSize[]
  preferredSize: WidgetSize
  priority: number
  anchor?: 'left'
}

/** Default metadata for widgets that don't support adaptive sizing */
export const DEFAULT_WIDGET_META: WidgetMeta = {
  supportedSizes: ['standard'],
  preferredSize: 'standard',
  priority: 0,
}

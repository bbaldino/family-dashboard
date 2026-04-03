export type WidgetSize = 'compact' | 'standard' | 'expanded'

export type WidgetMeta =
  | { visible: false }
  | { visible: true; preferredSize: WidgetSize; priority: number }

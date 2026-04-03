export type WidgetSize = 'compact' | 'standard' | 'expanded'

export type WidgetMeta =
  | { visible: false }
  | { visible: true; preferredSize: WidgetSize; priority: number }

/** Default metadata for widgets that don't have a useWidgetMeta hook yet */
export const DEFAULT_WIDGET_META: WidgetMeta = {
  visible: true,
  preferredSize: 'standard',
  priority: 0,
}

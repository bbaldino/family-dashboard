export type Orientation = 'vertical' | 'horizontal' | 'square'
export type RelativeSize = 'small' | 'medium' | 'large' | 'xlarge'

export interface WidgetSizePreference {
  orientation: Orientation
  relativeSize: RelativeSize
}

export type WidgetMeta =
  | { visible: false }
  | {
      visible: true
      priority: number
      sizePreference: WidgetSizePreference
      anchor?: { column: number; row: number }
    }

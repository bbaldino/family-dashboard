import type { ComponentType } from 'react'

export type ScreenKey =
  'home' | 'calendar' | 'media' | 'media.artist' | 'media.album' | 'cameras' | 'health'

export type CanvasSpec =
  | { model: 'fluid' }
  | {
      model: 'fixed-scale'
      designWidth: number
      designHeight: number
      minViewportWidth: number
    }

export interface ThemeModule {
  id: string
  name: string
  canvas: CanvasSpec
  layout?: ComponentType
  screens: Partial<Record<ScreenKey, ComponentType>>
  overlays: ComponentType[]
}

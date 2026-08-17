import type { ComponentType } from 'react'
import type { z } from 'zod'
import type { FieldMeta } from '@/platform'

export type ScreenKey =
  'home' | 'calendar' | 'media' | 'media.artist' | 'media.album' | 'sports' | 'cameras' | 'health'

export type CanvasSpec =
  | { model: 'fluid' }
  | {
      model: 'fixed-scale'
      designWidth: number
      designHeight: number
      minViewportWidth: number
    }

export interface ThemeSettings<T extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>> {
  schema: T
  fields: Record<keyof z.infer<T>, FieldMeta>
  /** The schema is the source of truth for validation and defaults, but
   *  there is no generic renderer — every theme that declares `settings`
   *  supplies the component that renders it. */
  Component: ComponentType
}

export interface ThemeModule {
  id: string
  name: string
  canvas: CanvasSpec
  layout?: ComponentType
  screens: Partial<Record<ScreenKey, ComponentType>>
  overlays: ComponentType[]
  settings?: ThemeSettings
}

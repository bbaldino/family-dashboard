import { ThemePicker } from './ThemePicker'
import { ThemeSettings } from '@/palettes/ThemeSettings'

/**
 * The Theme settings page: pick the presentation (grid vs broadsheet), then
 * the palette. Palette applies to grid only — broadsheet carries its own
 * fixed editorial colours.
 */
export function ThemeAdmin() {
  return (
    <div>
      <ThemePicker />
      <ThemeSettings />
    </div>
  )
}

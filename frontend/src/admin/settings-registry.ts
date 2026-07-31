import type { ComponentType } from 'react'
import { SportsSettings } from '@/admin/settings/sports/SportsSettings'
import { GoogleCalendarSettings } from '@/admin/settings/google-calendar/GoogleCalendarSettings'
import { CountdownsSettings } from '@/admin/settings/countdowns/CountdownsSettings'
import { ChoreAdmin } from '@/admin/ChoreAdmin'
import { DoorbellSettings } from '@/admin/settings/doorbell/DoorbellSettings'
import { TimersSettings } from '@/admin/settings/timers/TimersSettings'
import { MusicSettings } from '@/admin/settings/music/MusicSettings'
import { LlmSettings } from '@/admin/settings/llm/LlmSettings'
import { DashboardSettings } from '@/admin/settings/dashboard/DashboardSettings'
import { ThemeAdmin } from '@/admin/settings/theme/ThemeAdmin'

/**
 * Maps an integration id (e.g. 'sports', 'chores') to its admin settings
 * form component. Integration definitions deliberately carry no reference to
 * a settings component: they live in the data layer, which must not reference
 * React components. Admin owns that association, here.
 */
export const settingsRegistry: Record<string, ComponentType<Record<string, never>>> = {
  sports: SportsSettings,
  'google-calendar': GoogleCalendarSettings,
  countdowns: CountdownsSettings,
  chores: ChoreAdmin,
  doorbell: DoorbellSettings,
  timers: TimersSettings,
  music: MusicSettings,
  llm: LlmSettings,
  dashboard: DashboardSettings,
  theme: ThemeAdmin,
}

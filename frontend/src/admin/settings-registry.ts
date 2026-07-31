import type { ComponentType } from 'react'
import { SportsSettings } from '@/admin/settings/sports/SportsSettings'
import { GoogleCalendarSettings } from '@/admin/settings/google-calendar/GoogleCalendarSettings'
import { CountdownsSettings } from '@/admin/settings/countdowns/CountdownsSettings'
import { ChoreAdmin } from '@/admin/ChoreAdmin'
import { DoorbellSettings } from '@/admin/settings/doorbell/DoorbellSettings'
import { TimersSettings } from '@/admin/settings/timers/TimersSettings'
import { MusicSettings } from '@/admin/settings/music/MusicSettings'

/**
 * Maps an integration id (e.g. 'sports', 'chores') to its admin settings
 * form component. Admin uses this instead of pulling a `settingsComponent`
 * off the integration definition — the data layer must not reference React
 * components.
 *
 * As integrations migrate under Phase 3a/3b, their settings component is
 * added here and the `settingsComponent` field on their config is removed.
 * Backwards-compat lookup on `integration.settingsComponent` remains in
 * SettingsAdmin.tsx until Phase 3b is complete.
 */
export const settingsRegistry: Record<string, ComponentType<Record<string, never>>> = {
  sports: SportsSettings,
  'google-calendar': GoogleCalendarSettings,
  countdowns: CountdownsSettings,
  chores: ChoreAdmin,
  doorbell: DoorbellSettings,
  timers: TimersSettings,
  music: MusicSettings,
}

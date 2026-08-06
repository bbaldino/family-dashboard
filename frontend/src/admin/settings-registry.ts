import type { ComponentType } from 'react'
import type { Integration } from '@/platform'
import { choresIntegration } from '@/integrations/chores'
import { countdownsIntegration } from '@/integrations/countdowns'
import { doorbellIntegration } from '@/integrations/doorbell'
import { nutrisliceIntegration } from '@/integrations/nutrislice'
import { weatherIntegration } from '@/integrations/weather'
import { googleCloudProvider } from '@/providers/google-cloud'
import { googleCalendarIntegration } from '@/integrations/google-calendar'
import { sportsIntegration } from '@/integrations/sports'
import { timersIntegration } from '@/integrations/timers'
import { themeIntegration } from '@/palettes/config'
import { drivingTimeIntegration } from '@/integrations/driving-time'
import { musicIntegration } from '@/integrations/music'
import { llmProvider } from '@/providers/llm'
import { onThisDayIntegration } from '@/integrations/on-this-day'
import { wordOfTheDayIntegration } from '@/integrations/word-of-the-day'
import { SportsSettings } from '@/admin/settings/sports/SportsSettings'
import { GoogleCalendarSettings } from '@/admin/settings/google-calendar/GoogleCalendarSettings'
import { CountdownsSettings } from '@/admin/settings/countdowns/CountdownsSettings'
import { ChoreAdmin } from '@/admin/ChoreAdmin'
import { DoorbellSettings } from '@/admin/settings/doorbell/DoorbellSettings'
import { TimersSettings } from '@/admin/settings/timers/TimersSettings'
import { MusicSettings } from '@/admin/settings/music/MusicSettings'
import { LlmSettings } from '@/admin/settings/llm/LlmSettings'
import { ThemeAdmin } from '@/admin/settings/theme/ThemeAdmin'

/**
 * Everything with a settings form — integrations and providers alike — in
 * admin sidebar order. This is the admin screen's own list, not a statement
 * about how each entry gets its data; see
 * `docs/superpowers/specs/2026-08-05-client-vs-service-integrations.md` for
 * that classification. `SettingsAdmin.tsx` is the only consumer.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const settingsEntries: Integration<any>[] = [
  choresIntegration,
  countdownsIntegration,
  doorbellIntegration,
  nutrisliceIntegration,
  weatherIntegration,
  googleCloudProvider,
  googleCalendarIntegration,
  sportsIntegration,
  timersIntegration,
  themeIntegration,
  drivingTimeIntegration,
  musicIntegration,
  llmProvider,
  onThisDayIntegration,
  wordOfTheDayIntegration,
]

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
  theme: ThemeAdmin,
}

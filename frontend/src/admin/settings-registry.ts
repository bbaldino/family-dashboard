import type { ComponentType } from 'react'
import { SportsSettings } from './settings/sports/SportsSettings'

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
export const settingsRegistry: Record<string, ComponentType> = {
  sports: SportsSettings,
}

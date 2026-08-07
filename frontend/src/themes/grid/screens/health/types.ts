/**
 * A re-export shim, deliberately.
 *
 * The data shapes and the status ranking both belong to
 * `integrations/health` — the shapes because they describe what the
 * integration returns, and `severity` because which status is *worse* is a
 * fact about health data rather than a rendering choice. The theme carried
 * its own copies of both until they drifted (its `Service` had silently
 * missed `recent_incidents`), which is why they are gone.
 *
 * What is genuinely this theme's lives next door in `tone.ts`: which colour,
 * label and border a status gets.
 *
 * This file stays only so the screen's own modules can keep importing from
 * `./types`. Re-export what the theme actually uses and nothing more — an
 * unused re-export is a name the next person has to check before deleting.
 */
export type {
  HealthComponent,
  HistorySample,
  Service,
  Status,
  UptimeReport,
} from '@/integrations/health'

export { severity } from '@/integrations/health'

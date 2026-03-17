import type { Integration } from './define-integration'
import { countdownsIntegration } from './countdowns/config'
import { doorbellIntegration } from './doorbell/config'
import { nutrisliceIntegration } from './nutrislice/config'
import { weatherIntegration } from './weather/config'
import { googleCalendarIntegration } from './google-calendar/config'

// Integrations listed here appear in the generic settings page.
// Chores has its own dedicated admin tab, so it's not included here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const integrations: Integration<any>[] = [
  countdownsIntegration,
  doorbellIntegration,
  nutrisliceIntegration,
  weatherIntegration,
  googleCalendarIntegration,
]

import type { Integration } from './define-integration'
import { choresIntegration } from './chores/config'
import { countdownsIntegration } from './countdowns/config'
import { doorbellIntegration } from './doorbell/config'
import { nutrisliceIntegration } from './nutrislice/config'
import { weatherIntegration } from './weather/config'
import { googleCalendarIntegration } from './google-calendar/config'
import { sportsIntegration } from './sports/config'
import { packagesIntegration } from './packages/config'
import { themeIntegration } from '@/theme/config'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const integrations: Integration<any>[] = [
  choresIntegration,
  countdownsIntegration,
  doorbellIntegration,
  nutrisliceIntegration,
  weatherIntegration,
  googleCalendarIntegration,
  sportsIntegration,
  packagesIntegration,
  themeIntegration,
]

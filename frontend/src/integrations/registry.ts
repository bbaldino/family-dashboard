import type { Integration } from './define-integration'
import { nutrisliceIntegration } from './nutrislice/config'
import { weatherIntegration } from './weather/config'
import { googleCalendarIntegration } from './google-calendar/config'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const integrations: Integration<any>[] = [
  nutrisliceIntegration,
  weatherIntegration,
  googleCalendarIntegration,
]

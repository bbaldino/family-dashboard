import type { Integration } from './define-integration'
import { z } from 'zod'
import { nutrisliceIntegration } from './nutrislice/config'
import { weatherIntegration } from './weather/config'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const integrations: Integration<any>[] = [
  nutrisliceIntegration,
  weatherIntegration,
]

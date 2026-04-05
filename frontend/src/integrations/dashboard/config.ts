import { z } from 'zod'
import { defineIntegration } from '../define-integration'
import { DashboardSettings } from './DashboardSettings'

export const dashboardIntegration = defineIntegration({
  id: 'dashboard',
  name: 'Dashboard',
  hasBackend: false,
  schema: z.object({}),
  fields: {},
  settingsComponent: DashboardSettings,
})

import { z } from 'zod'
import { defineIntegration } from '../define-integration'
import { DoorbellSettings } from './DoorbellSettings'

export const doorbellIntegration = defineIntegration({
  id: 'doorbell',
  name: 'Doorbell Camera',
  hasBackend: false,
  schema: z.object({}),
  fields: {},
  settingsComponent: DoorbellSettings,
})

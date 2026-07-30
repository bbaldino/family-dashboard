import { z } from 'zod'
import { defineIntegration } from '@/integrations/define-integration'
import { ThemeSettings } from './ThemeSettings'

export const themeIntegration = defineIntegration({
  id: 'theme',
  name: 'Theme',
  hasBackend: false,
  schema: z.object({}),
  fields: {},
  settingsComponent: ThemeSettings,
})

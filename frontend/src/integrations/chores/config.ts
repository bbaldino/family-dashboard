import { z } from 'zod'
import { defineIntegration } from '../define-integration'
import { ChoreAdmin } from '@/admin/ChoreAdmin'

export const choresIntegration = defineIntegration({
  id: 'chores',
  name: 'Chores',
  schema: z.object({}),
  fields: {},
  settingsComponent: ChoreAdmin,
})

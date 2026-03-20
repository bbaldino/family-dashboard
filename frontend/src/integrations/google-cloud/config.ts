import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const googleCloudIntegration = defineIntegration({
  id: 'google-cloud',
  name: 'Google Cloud',
  hasBackend: false,
  schema: z.object({
    client_id: z.string().optional(),
    client_secret: z.string().optional(),
    redirect_uri: z.string().optional(),
    api_key: z.string().optional(),
  }),
  fields: {
    client_id: { label: 'OAuth Client ID', type: 'secret' },
    client_secret: { label: 'OAuth Client Secret', type: 'secret' },
    redirect_uri: { label: 'OAuth Redirect URI' },
    api_key: { label: 'API Key', type: 'secret', description: 'For Routes API, etc.' },
  },
})

import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const weatherIntegration = defineIntegration({
  id: 'weather',
  name: 'Weather',
  schema: z.object({
    api_key: z.string().min(1, 'API key is required'),
    lat: z.string().min(1, 'Latitude is required'),
    lon: z.string().min(1, 'Longitude is required'),
  }),
  fields: {
    api_key: { label: 'OpenWeatherMap API Key', type: 'secret' },
    lat: { label: 'Latitude' },
    lon: { label: 'Longitude' },
  },
})

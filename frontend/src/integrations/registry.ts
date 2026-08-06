import type { Integration } from '@/platform'
import { choresIntegration } from '@/integrations/chores'
import { countdownsIntegration } from '@/integrations/countdowns'
import { doorbellIntegration } from '@/integrations/doorbell'
import { nutrisliceIntegration } from '@/integrations/nutrislice'
import { weatherIntegration } from '@/integrations/weather'
import { googleCloudIntegration } from '@/integrations/google-cloud'
import { googleCalendarIntegration } from '@/integrations/google-calendar'
import { sportsIntegration } from '@/integrations/sports'
import { packagesIntegration } from '@/integrations/packages'
import { timersIntegration } from '@/integrations/timers'
import { themeIntegration } from '@/palettes/config'
import { drivingTimeIntegration } from '@/integrations/driving-time'
import { planIntegration } from '@/integrations/plan'
import { musicIntegration } from '@/integrations/music'
import { llmIntegration } from '@/integrations/llm'
import { onThisDayIntegration } from '@/integrations/on-this-day'
import { wordOfTheDayIntegration } from '@/integrations/word-of-the-day'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const integrations: Integration<any>[] = [
  choresIntegration,
  countdownsIntegration,
  doorbellIntegration,
  nutrisliceIntegration,
  weatherIntegration,
  googleCloudIntegration,
  googleCalendarIntegration,
  sportsIntegration,
  packagesIntegration,
  timersIntegration,
  themeIntegration,
  drivingTimeIntegration,
  planIntegration,
  musicIntegration,
  llmIntegration,
  onThisDayIntegration,
  wordOfTheDayIntegration,
]

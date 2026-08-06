import type { Integration } from '@/platform'
import { choresIntegration } from '@/data/chores'
import { countdownsIntegration } from '@/data/countdowns'
import { doorbellIntegration } from '@/data/doorbell'
import { nutrisliceIntegration } from '@/data/nutrislice'
import { weatherIntegration } from '@/data/weather'
import { googleCloudIntegration } from '@/data/google-cloud'
import { googleCalendarIntegration } from '@/data/google-calendar'
import { sportsIntegration } from '@/data/sports'
import { packagesIntegration } from '@/data/packages'
import { timersIntegration } from '@/data/timers'
import { themeIntegration } from '@/palettes/config'
import { drivingTimeIntegration } from '@/data/driving-time'
import { planIntegration } from '@/data/plan'
import { musicIntegration } from '@/data/music'
import { llmIntegration } from '@/data/llm'
import { onThisDayIntegration } from '@/data/on-this-day'
import { wordOfTheDayIntegration } from '@/data/word-of-the-day'

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

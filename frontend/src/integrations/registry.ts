import type { Integration } from './define-integration'
import { choresIntegration } from './chores/config'
import { countdownsIntegration } from './countdowns/config'
import { doorbellIntegration } from './doorbell/config'
import { nutrisliceIntegration } from './nutrislice/config'
import { weatherIntegration } from './weather/config'
import { googleCloudIntegration } from './google-cloud/config'
import { googleCalendarIntegration } from './google-calendar/config'
import { sportsIntegration } from './sports/config'
import { packagesIntegration } from './packages/config'
import { timersIntegration } from './timers/config'
import { themeIntegration } from '@/theme/config'
import { drivingTimeIntegration } from './driving-time/config'
import { planIntegration } from './plan/config'
import { musicIntegration } from './music/config'
import { dashboardIntegration } from './dashboard/config'
import { ollamaIntegration } from './ollama/config'
import { onThisDayIntegration } from './on-this-day/config'
import { wordOfTheDayIntegration } from './word-of-the-day/config'
import { dailyQuoteIntegration } from './daily-quote/config'
import { triviaIntegration } from './trivia/config'
import { jokesIntegration } from './jokes/config'
import { tmdbIntegration } from './tmdb/config'

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
  dashboardIntegration,
  ollamaIntegration,
  onThisDayIntegration,
  wordOfTheDayIntegration,
  dailyQuoteIntegration,
  triviaIntegration,
  jokesIntegration,
  tmdbIntegration,
]

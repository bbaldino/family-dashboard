import { useIntegrationData } from '@/platform'
import { wordOfTheDayIntegration } from './config'
import { parseWordOfTheDay } from './feed'
import type { WordOfTheDayData } from './feed'

export type { WordOfTheDayData }

const FEED_URL = 'https://www.merriam-webster.com/wotd/feed/rss2'

/**
 * Same header the deleted Rust route sent to the (now Cloudflare-gated) HTML
 * page. Kept here because it's measured clean against this feed too (5/5
 * successes) — no reason to drop an identifying header that already works.
 */
const USER_AGENT = 'DashboardApp/1.0 (family kitchen dashboard)'

/**
 * The feed publishes a new word at 01:00 US Eastern. An hour comfortably
 * covers that (plus the household's own timezone offset from Eastern)
 * without polling so tightly that a slow or blocked fetch retries for no
 * reason — the feed's ten-item window means even a missed hour still has
 * yesterday's word to fall back to (see `pickTodaysItem` in `feed.ts`).
 * `ttlSecs` (server cache) and `refetchInterval` (client poll) share this
 * one constant so they can't drift into two numbers that used to "match".
 */
const REFRESH_SECS = 60 * 60

interface FetchTextResponse {
  text: string
}

/**
 * Module scope, not an inline arrow: react-query memoizes `select` against
 * the function's identity, so an inline one is a new identity every render
 * and re-runs the transform each time — here two full `DOMParser` passes
 * over a ~40 KB feed. `now` still defaults at call time, so hoisting doesn't
 * freeze the date.
 */
function selectWord(raw: FetchTextResponse): WordOfTheDayData {
  return parseWordOfTheDay(raw.text)
}

export function useWordOfTheDay() {
  return useIntegrationData<FetchTextResponse, WordOfTheDayData>(
    wordOfTheDayIntegration,
    () => ({
      url: FEED_URL,
      headers: { 'User-Agent': USER_AGENT },
      expect: 'text',
      ttlSecs: REFRESH_SECS,
      refetchInterval: REFRESH_SECS * 1000,
    }),
    { select: selectWord },
  )
}

import { defineIntegration, useIntegrationQuery } from '@/platform'

/**
 * Daily quote — the whole integration.
 *
 * Replaces, from the old scheme:
 *   backend/daily_quote/mod.rs        (15 lines — router + cache wiring)
 *   backend/daily_quote/routes.rs     (111 lines — client, 24h cache, fetch,
 *                                      4 error branches, reshape)
 *   frontend/daily-quote/config.ts    (9 lines)
 *   frontend/daily-quote/index.ts     (2 lines)
 *   frontend/daily-quote/useDailyQuote.ts (17 lines)
 *   + 2 lines in backend/src/integrations/mod.rs
 *
 * The 24h cache and the bounded HTTP client are the platform's job now, not
 * this file's. Error mapping only partly is: the platform validates HTTP
 * status, but not payload shape, so an empty or malformed ZenQuotes response
 * is still this file's problem to catch in `select` — the deleted Rust had
 * an explicit `.ok_or_else(...)` for exactly this ("ZenQuotes returned empty
 * response"); a plain destructure here would turn that into an uncaught
 * `TypeError` instead.
 */

export const dailyQuoteIntegration = defineIntegration({
  id: 'daily-quote',
  name: 'Daily Quote',
})

export interface DailyQuoteData {
  quote: string
  author: string
}

/** ZenQuotes returns an array of one, with single-letter keys. */
interface ZenQuote {
  q: string
  a: string
}

const ZENQUOTES_URL = 'https://zenquotes.io/api/today'

export function useDailyQuote() {
  return useIntegrationQuery<ZenQuote[], DailyQuoteData>(dailyQuoteIntegration, ZENQUOTES_URL, {
    ttlSecs: 86400,
    select: (quotes) => {
      const first = quotes?.[0]
      // Guard the destructure: an empty array (or a payload that isn't the
      // shape ZenQuotes promises) must produce a clear thrown error here,
      // not a `TypeError` from destructuring `undefined`.
      if (!first || typeof first.q !== 'string' || typeof first.a !== 'string') {
        throw new Error('ZenQuotes returned an empty or malformed response')
      }
      return { quote: first.q, author: first.a }
    },
    refetchInterval: 60 * 60 * 1000,
  })
}

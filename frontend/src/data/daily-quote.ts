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
 * The 24h cache, the bounded HTTP client, and the error mapping are the
 * platform's job now, not this file's.
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

export function useDailyQuote() {
  return useIntegrationQuery<ZenQuote[], DailyQuoteData>(dailyQuoteIntegration, 'today', {
    select: ([first]) => ({ quote: first.q, author: first.a }),
    refetchInterval: 60 * 60 * 1000,
  })
}

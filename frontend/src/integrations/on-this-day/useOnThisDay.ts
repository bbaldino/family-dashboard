import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useIntegrationConfig, useIntegrationData } from '@/platform'
import { generate } from '@/providers/llm'
import { onThisDayIntegration } from './config'
import { buildPrompt, mergeFeeds, parsePicks, preFilter, toEvent } from './curate'
import type { OnThisDayEvent, WikiEvent } from './curate'

/**
 * Three composed queries where the Rust route had one handler: Wikipedia's
 * `selected` and `events` feeds through the fetch capability, then a dependent
 * query that asks the LLM to curate what survives the keyword filter.
 *
 * The reshaping lives in `curate.ts`; everything here is the wiring, and it is
 * where the Rust's *tolerances* had to be reproduced by hand:
 *
 *   - **A failing feed is not an error.** `routes.rs` returned `vec![]` on
 *     fetch failure, non-success status *and* parse failure, then carried on
 *     with whatever the other feed gave it. Reading `?? []` off each query
 *     rather than propagating its error state is what preserves that.
 *   - **An LLM failure falls back to the whole filtered pool**, uncapped —
 *     not the five the prompt asks for. The widget cycles one event at a
 *     time, so a long list degrades gracefully.
 *   - **An empty result is never cached.** The Rust cached only non-empty
 *     responses, so an empty day retried on the next request instead of
 *     sticking for six hours. `curate` throws instead of resolving `[]`;
 *     react-query does not cache a rejected query.
 */

/** One definition of the widget's event type, re-exported for consumers. */
export type { OnThisDayEvent }

export interface OnThisDayData {
  events: OnThisDayEvent[]
}

const WIKI_BASE = 'https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday'

/** The header the deleted Rust route identified itself to Wikimedia with. */
const USER_AGENT = 'DashboardApp/1.0 (family kitchen dashboard)'

/** The Rust cache's TTL, now the fetch capability's and the curation query's. */
const CACHE_TTL_SECS = 6 * 60 * 60

/**
 * The old hook's poll cadence, kept. Its job is no longer to re-read a
 * server-side cache — `ttlSecs` covers that, so an hourly refetch of an
 * unchanged day is served from the backend cache — but to re-render, which is
 * what recomputes the date below. Without it a wall display that never
 * remounts would still be showing yesterday's events tomorrow.
 */
const REFRESH_MS = 60 * 60 * 1000

interface WikiSelectedResponse {
  selected?: WikiEvent[] | null
}

interface WikiEventsResponse {
  events?: WikiEvent[] | null
}

/**
 * Module scope, not an inline arrow: react-query memoizes `select` against the
 * function's identity, so an inline one re-runs every render and — worse here
 * — hands back a fresh array each time, which would make the `useMemo` below
 * recompute the pool and churn the curation query key.
 *
 * A null or absent array is an empty list, never an error (the Rust's
 * `unwrap_or_default`).
 */
function selectSelectedFeed(raw: WikiSelectedResponse | undefined): WikiEvent[] {
  return raw?.selected ?? []
}

/** See `selectSelectedFeed`. */
function selectEventsFeed(raw: WikiEventsResponse | undefined): WikiEvent[] {
  return raw?.events ?? []
}

/**
 * Asks the model to pick from the pool, resolving its answer back to events.
 *
 * Both of the Rust's failure behaviours are here: a failed call degrades to
 * the whole filtered pool, and an empty final list throws so nothing caches
 * it. Note the empty case covers a *successful* call the model answered
 * unusably too — the Rust reached the same place, with `curate_events`
 * returning `Ok(vec![])` and the response then failing its non-empty check.
 */
async function curate(pool: WikiEvent[], model: string): Promise<OnThisDayEvent[]> {
  let events: OnThisDayEvent[]
  try {
    events = parsePicks(await generate(model, buildPrompt(pool)), pool)
  } catch {
    events = pool.map(toEvent)
  }
  if (events.length === 0) {
    throw new Error('on-this-day: curation produced no events')
  }
  return events
}

export function useOnThisDay(): { data: OnThisDayData | undefined; isLoading: boolean } {
  // Read once per render so the two feeds and the curation key can never
  // straddle midnight between them. Local, and zero-padded — the Rust used
  // `chrono::Local` with `{:02}`, and Wikipedia 404s on `3/9`.
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const dateKey = `${mm}-${dd}`

  const selectedQuery = useIntegrationData<WikiSelectedResponse | undefined, WikiEvent[]>(
    onThisDayIntegration,
    () => ({
      url: `${WIKI_BASE}/selected/${mm}/${dd}`,
      headers: { 'User-Agent': USER_AGENT },
      ttlSecs: CACHE_TTL_SECS,
      refetchInterval: REFRESH_MS,
    }),
    { select: selectSelectedFeed },
  )

  const eventsQuery = useIntegrationData<WikiEventsResponse | undefined, WikiEvent[]>(
    onThisDayIntegration,
    () => ({
      url: `${WIKI_BASE}/events/${mm}/${dd}`,
      headers: { 'User-Agent': USER_AGENT },
      ttlSecs: CACHE_TTL_SECS,
      refetchInterval: REFRESH_MS,
    }),
    { select: selectEventsFeed },
  )

  // `?? []` rather than the query's error state: one feed failing must not
  // blank the widget.
  const selected = selectedQuery.data
  const general = eventsQuery.data
  const pool = useMemo(
    () => preFilter(mergeFeeds(selected ?? [], general ?? [])),
    [selected, general],
  )

  const model = useIntegrationConfig(onThisDayIntegration)?.model

  // A cheap stable digest, so a feed arriving late re-runs curation instead of
  // leaving the earlier feed's picks up. Not the pool itself: react-query
  // hashes the key on every render, and that would serialise tens of
  // kilobytes each time.
  const poolKey = `${pool.length}:${pool[0]?.text ?? ''}:${pool[pool.length - 1]?.text ?? ''}`

  // Both feeds have to *settle* — resolved or failed — before the model sees
  // anything. `pool.length > 0` alone is not that gate: the selected feed
  // usually wins the race, and curation would fire against half a pool, then
  // fire again when the other feed landed and changed `poolKey`. That is two
  // LLM calls where `routes.rs` made one (it `join!`ed both feeds first), and
  // the wasted one is the one whose picks the widget briefly shows.
  const feedsSettled = !selectedQuery.isPending && !eventsQuery.isPending
  const curationEnabled = feedsSettled && pool.length > 0 && !!model
  const curation = useQuery({
    // `model` is in the key so changing it in settings re-curates rather than
    // serving the previous model's picks for the rest of the day.
    queryKey: ['on-this-day', 'curated', dateKey, model, poolKey],
    enabled: curationEnabled,
    queryFn: () => curate(pool, model!),
    staleTime: CACHE_TTL_SECS * 1000,
  })

  const data = useMemo(
    () => (curation.data ? { events: curation.data } : undefined),
    [curation.data],
  )

  // `isPending`, not `isLoading`, for the feeds: they are disabled until
  // `/api/config` resolves, and a disabled query reports `isLoading: false` —
  // which would flash "No events today" on every cold load. An errored feed is
  // settled, not pending, so a failing feed still lets the widget render.
  const isLoading =
    selectedQuery.isPending || eventsQuery.isPending || (curationEnabled && curation.isPending)

  return { data, isLoading }
}

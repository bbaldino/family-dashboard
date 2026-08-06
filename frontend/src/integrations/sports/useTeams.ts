import { useCallback } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { sportsIntegration } from './config'
import type { TeamInfo, TeamsResponse } from './types'

/** Below this many characters the search endpoint isn't worth calling — and at
 *  zero it would return the whole world. The threshold lives here so no caller
 *  has to remember it. */
const MIN_SEARCH_LENGTH = 2

/** One roster per league, one cache entry per league. Both the settings screen's
 *  league browser and its legacy backfill key off this, so a league fetched by
 *  one is already loaded for the other. */
export const leagueTeamsQueryKey = (leagueId: string) => ['sports', 'teams', 'league', leagueId]

/** The single `/teams?league=` fetch, shared by the hook and the fetcher below.
 *  `.teams` is unwrapped here so callers see a plain array. */
function leagueTeamsQuery(leagueId: string) {
  return {
    queryKey: leagueTeamsQueryKey(leagueId),
    queryFn: async (): Promise<TeamInfo[]> => {
      const data = await sportsIntegration.api.get<TeamsResponse>(`/teams?league=${leagueId}`)
      return data.teams
    },
  }
}

/**
 * A league's roster, for the settings screen's browse-by-league panel. Pass
 * `null` when no league is expanded and nothing is fetched.
 */
export function useLeagueTeams(leagueId: string | null) {
  return useQuery({
    ...leagueTeamsQuery(leagueId ?? ''),
    enabled: leagueId !== null,
  })
}

/**
 * The same roster fetch as an imperative callback, for the one caller that
 * cannot use the hook: `SportsSettings`' legacy backfill loops over however
 * many leagues the saved config happens to mention, and it only knows which
 * ones *after* an unrelated `/api/config` fetch has resolved. A hook per
 * league would be a rules-of-hooks violation — the list's length varies
 * between renders and the loop is conditional on the data being legacy.
 *
 * Routing through `fetchQuery` rather than calling `api` directly is what
 * keeps this honest: the backfill fills the very cache entries
 * `useLeagueTeams` reads, so expanding a league the backfill already
 * loaded costs no second request. Rejects on failure, like a bare fetch,
 * so callers can keep their own try/catch.
 */
export function useLeagueTeamsFetcher() {
  const queryClient = useQueryClient()
  return useCallback(
    (leagueId: string) => queryClient.fetchQuery(leagueTeamsQuery(leagueId)),
    [queryClient],
  )
}

/**
 * Team search across every league. The query is url-encoded here — a caller
 * passes raw user input and never has to think about the ampersand someone
 * types into "Nitro & Sons".
 *
 * `keepPreviousData` matches what the hand-rolled version did by only
 * replacing results on success: the previous matches stay on screen while
 * the next keystroke's request is in flight, instead of the list blanking
 * once per character. It is deliberately not applied below the length
 * threshold, so clearing the box clears the results.
 */
export function useTeamSearch(query: string) {
  const enabled = query.length >= MIN_SEARCH_LENGTH
  return useQuery({
    queryKey: ['sports', 'teams', 'search', query],
    queryFn: async (): Promise<TeamInfo[]> => {
      const data = await sportsIntegration.api.get<TeamsResponse>(
        `/teams/search?q=${encodeURIComponent(query)}`,
      )
      return data.teams
    },
    enabled,
    placeholderData: enabled ? keepPreviousData : undefined,
  })
}

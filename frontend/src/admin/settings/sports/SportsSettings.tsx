import { useState, useEffect, useMemo } from 'react'
import { useAllConfig, useSaveConfig } from '@/platform'
import { Button } from '@/ui/Button'
import { ModelSelect } from '@/admin/settings/llm/ModelSelect'
import {
  useLeagueTeams,
  useLeagueTeamsFetcher,
  useTeamSearch,
  type TeamInfo,
  type TrackedTeam,
} from '@/integrations/sports'

const LEAGUES = [
  { id: 'nba', name: 'NBA' },
  { id: 'nfl', name: 'NFL' },
  { id: 'mlb', name: 'MLB' },
  { id: 'nhl', name: 'NHL' },
]

function parseTrackedTeams(raw: string | undefined): { teams: TrackedTeam[]; failed: boolean } {
  if (!raw) return { teams: [], failed: false }
  try {
    return { teams: JSON.parse(raw), failed: false }
  } catch {
    return { teams: [], failed: true }
  }
}

/**
 * Prefilled once from the shared `/api/config` query, then left alone — same
 * split as `themes/grid/GridSettingsPanel.tsx`: this outer half tracks the
 * live query and re-renders on every poll; the inner form's lazy `useState`
 * initialisers read it once at mount and ignore every later value, so a poll
 * tick can't overwrite an in-progress edit.
 */
export function SportsSettings() {
  const { data, isPending } = useAllConfig()

  if (isPending) {
    return <div className="text-text-muted text-sm">Loading...</div>
  }

  return <SportsSettingsForm config={data} />
}

function SportsSettingsForm({ config }: { config: Record<string, string> | undefined }) {
  // Memoised rather than a plain lazy `useState`, because the legacy-backfill
  // effect below needs the same parsed-once value without re-parsing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const parsed = useMemo(() => parseTrackedTeams(config?.['sports.tracked_teams']), [])

  const [trackedTeams, setTrackedTeams] = useState<TrackedTeam[]>(() => parsed.teams)
  const [expandedLeague, setExpandedLeague] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [pollLive, setPollLive] = useState(() => config?.['sports.poll_interval_live'] ?? '5')
  const [pollIdle, setPollIdle] = useState(() => config?.['sports.poll_interval_idle'] ?? '900')
  const [windowHours, setWindowHours] = useState(() => config?.['sports.window_hours'] ?? '24')
  const [model, setModel] = useState(() => config?.['sports.model'] ?? 'llama3.1:8b')
  const [error, setError] = useState<string | null>(
    config === undefined
      ? 'Failed to load settings'
      : parsed.failed
        ? 'Failed to load settings'
        : null,
  )
  const [status, setStatus] = useState<string | null>(null)
  const saveConfig = useSaveConfig()

  // Only the expanded league is ever rendered, so one query covers the panel.
  const { data: expandedTeams, isError: expandedTeamsFailed } = useLeagueTeams(expandedLeague)
  const { data: searchResults, isFetching: searching } = useTeamSearch(searchQuery)
  const fetchLeagueTeams = useLeagueTeamsFetcher()

  useEffect(() => {
    if (expandedTeamsFailed && expandedLeague) {
      setError(`Failed to load ${expandedLeague.toUpperCase()} teams`)
    }
  }, [expandedTeamsFailed, expandedLeague])

  // Legacy backfill: entries saved before name/logo were stored get their
  // display info filled in once, against the config this form was seeded
  // with — same "runs once at mount" contract as the lazy `useState`s above,
  // just via an effect because it's genuinely async.
  useEffect(() => {
    const tracked = parsed.teams
    const needsBackfill = tracked.some((t) => !t.name)
    if (!needsBackfill) return
    let cancelled = false
    void (async () => {
      const leagueIds = [...new Set(tracked.map((t) => t.league))]
      const teamsByLeague: Record<string, TeamInfo[]> = {}
      await Promise.all(
        leagueIds.map(async (leagueId) => {
          try {
            teamsByLeague[leagueId] = await fetchLeagueTeams(leagueId)
          } catch {
            // skip — pills will just show the ID
          }
        }),
      )
      if (cancelled) return
      // No local copy to keep: `fetchLeagueTeams` filled the same cache
      // entries `useLeagueTeams` reads, so these leagues now expand without
      // a second request.
      const enriched = tracked.map((t) => {
        if (t.name) return t
        const info = teamsByLeague[t.league]?.find((team) => team.id === t.teamId)
        if (info) return { ...t, name: info.name, logo: info.logo }
        return t
      })
      setTrackedTeams(enriched)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleLeague = (leagueId: string) => {
    // Expanding is the whole trigger — `useLeagueTeams` fetches off this state.
    setExpandedLeague(expandedLeague === leagueId ? null : leagueId)
  }

  const isTracked = (league: string, teamId: string) =>
    trackedTeams.some((t) => t.league === league && t.teamId === teamId)

  const toggleTeam = (team: TeamInfo) => {
    setTrackedTeams((prev) => {
      if (isTracked(team.league, team.id)) {
        return prev.filter((t) => !(t.league === team.league && t.teamId === team.id))
      }
      return [...prev, { league: team.league, teamId: team.id, name: team.name, logo: team.logo }]
    })
  }

  const removeTeam = (league: string, teamId: string) => {
    setTrackedTeams((prev) => prev.filter((t) => !(t.league === league && t.teamId === teamId)))
  }

  const handleSave = async () => {
    try {
      setError(null)
      // One mutation for all five keys, so the shared config query refetches
      // once for this Save rather than five times.
      await saveConfig.mutateAsync([
        { key: 'sports.tracked_teams', value: JSON.stringify(trackedTeams) },
        { key: 'sports.poll_interval_live', value: pollLive },
        { key: 'sports.poll_interval_idle', value: pollIdle },
        { key: 'sports.window_hours', value: windowHours },
        { key: 'sports.model', value: model },
      ])
      setStatus('Saved!')
      setTimeout(() => setStatus(null), 2000)
    } catch {
      setError('Failed to save settings')
    }
  }

  return (
    <div className="space-y-6">
      {error && <div className="bg-error/10 text-error rounded-lg p-3 text-sm">{error}</div>}

      {/* Tracked teams summary */}
      {trackedTeams.length > 0 && (
        <div>
          <label className="text-xs text-text-muted block mb-2">Tracked Teams</label>
          <div className="flex flex-wrap gap-2">
            {trackedTeams.map((t) => (
              <span
                key={`${t.league}-${t.teamId}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-palette-6/10 text-palette-6 text-sm font-medium"
              >
                {t.logo && <img src={t.logo} alt="" className="w-4 h-4 object-contain" />}
                {t.name ?? t.teamId}
                <span className="text-palette-6/50 text-xs">{t.league.toUpperCase()}</span>
                <button
                  onClick={() => removeTeam(t.league, t.teamId)}
                  className="ml-1 text-palette-6/60 hover:text-palette-6"
                >
                  x
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div>
        <label className="text-xs text-text-muted block mb-1">Search Teams</label>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by team name..."
          className="w-full px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
        />
        {searching && <div className="text-xs text-text-muted mt-1">Searching...</div>}
        {searchResults && searchResults.length > 0 && (
          <div className="mt-2 border border-border rounded-lg overflow-hidden">
            {searchResults.map((team) => (
              <label
                key={`${team.league}-${team.id}`}
                className="flex items-center gap-3 p-2.5 hover:bg-bg-card-hover cursor-pointer border-b border-border last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={isTracked(team.league, team.id)}
                  onChange={() => toggleTeam(team)}
                  className="w-4 h-4 accent-palette-6"
                />
                <img src={team.logo} alt="" className="w-6 h-6 object-contain" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-text-primary">{team.displayName}</div>
                  <div className="text-xs text-text-muted">{team.league.toUpperCase()}</div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Per-league browsing */}
      <div>
        <label className="text-xs text-text-muted block mb-2">Browse by League</label>
        <div className="space-y-1">
          {LEAGUES.map((league) => (
            <div key={league.id} className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleLeague(league.id)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-text-primary hover:bg-bg-card-hover"
              >
                {league.name}
                <span className="text-text-muted text-xs">
                  {trackedTeams.filter((t) => t.league === league.id).length} tracked
                  {' · '}
                  {expandedLeague === league.id ? 'collapse' : 'expand'}
                </span>
              </button>
              {expandedLeague === league.id && (
                <div className="border-t border-border max-h-[300px] overflow-y-auto">
                  {!expandedTeams ? (
                    <div className="p-3 text-xs text-text-muted">Loading teams...</div>
                  ) : (
                    expandedTeams.map((team) => (
                      <label
                        key={team.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-bg-card-hover cursor-pointer border-b border-border last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={isTracked(league.id, team.id)}
                          onChange={() => toggleTeam(team)}
                          className="w-4 h-4 accent-palette-6"
                        />
                        <img src={team.logo} alt="" className="w-6 h-6 object-contain" />
                        <span className="text-sm text-text-primary">{team.displayName}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Polling config */}
      <div>
        <label className="text-xs text-text-muted block mb-2">Polling Intervals</label>
        <div className="flex gap-4">
          <div>
            <label className="text-xs text-text-muted block mb-1">Live (seconds)</label>
            <input
              type="number"
              value={pollLive}
              onChange={(e) => setPollLive(e.target.value)}
              className="w-24 px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Idle (seconds)</label>
            <input
              type="number"
              value={pollIdle}
              onChange={(e) => setPollIdle(e.target.value)}
              className="w-24 px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Window (hours)</label>
            <input
              type="number"
              value={windowHours}
              onChange={(e) => setWindowHours(e.target.value)}
              className="w-24 px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
            />
          </div>
        </div>
      </div>

      {/* AI preview model */}
      <div>
        <ModelSelect
          value={model}
          onChange={setModel}
          label="Model"
          description="Used to generate game previews."
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave}>Save</Button>
        {status && <span className="text-sm text-success">{status}</span>}
      </div>
    </div>
  )
}

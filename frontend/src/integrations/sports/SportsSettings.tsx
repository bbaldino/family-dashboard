import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/ui/Button'
import { sportsIntegration } from './config'
import type { TeamInfo, TrackedTeam } from './types'

const LEAGUES = [
  { id: 'nba', name: 'NBA' },
  { id: 'nfl', name: 'NFL' },
  { id: 'mlb', name: 'MLB' },
  { id: 'nhl', name: 'NHL' },
]

export function SportsSettings() {
  const [trackedTeams, setTrackedTeams] = useState<TrackedTeam[]>([])
  const [leagueTeams, setLeagueTeams] = useState<Record<string, TeamInfo[]>>({})
  const [expandedLeague, setExpandedLeague] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TeamInfo[]>([])
  const [searching, setSearching] = useState(false)
  const [pollLive, setPollLive] = useState('30')
  const [pollIdle, setPollIdle] = useState('900')
  const [windowHours, setWindowHours] = useState('24')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const config = await fetch('/api/config').then((r) => r.json()) as Record<string, string>
      const tracked = config['sports.tracked_teams']
      setTrackedTeams(tracked ? JSON.parse(tracked) : [])
      setPollLive(config['sports.poll_interval_live'] ?? '30')
      setPollIdle(config['sports.poll_interval_idle'] ?? '900')
      setWindowHours(config['sports.window_hours'] ?? '24')
    } catch {
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const loadLeagueTeams = async (leagueId: string) => {
    if (leagueTeams[leagueId]) return
    try {
      const data = await sportsIntegration.api.get<{ teams: TeamInfo[] }>(
        `/teams?league=${leagueId}`,
      )
      setLeagueTeams((prev) => ({ ...prev, [leagueId]: data.teams }))
    } catch {
      setError(`Failed to load ${leagueId.toUpperCase()} teams`)
    }
  }

  const toggleLeague = (leagueId: string) => {
    if (expandedLeague === leagueId) {
      setExpandedLeague(null)
    } else {
      setExpandedLeague(leagueId)
      loadLeagueTeams(leagueId)
    }
  }

  const isTracked = (league: string, teamId: string) =>
    trackedTeams.some((t) => t.league === league && t.teamId === teamId)

  const toggleTeam = (league: string, teamId: string) => {
    setTrackedTeams((prev) => {
      if (isTracked(league, teamId)) {
        return prev.filter((t) => !(t.league === league && t.teamId === teamId))
      }
      return [...prev, { league, teamId }]
    })
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const data = await sportsIntegration.api.get<{ teams: TeamInfo[] }>(
        `/teams/search?q=${encodeURIComponent(query)}`,
      )
      setSearchResults(data.teams)
    } catch {
      // Silently fail search
    } finally {
      setSearching(false)
    }
  }

  const handleSave = async () => {
    try {
      setError(null)
      const saves = [
        ['sports.tracked_teams', JSON.stringify(trackedTeams)],
        ['sports.poll_interval_live', pollLive],
        ['sports.poll_interval_idle', pollIdle],
        ['sports.window_hours', windowHours],
      ]
      for (const [key, value] of saves) {
        await fetch(`/api/config/${encodeURIComponent(key)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
        })
      }
      setStatus('Saved!')
      setTimeout(() => setStatus(null), 2000)
    } catch {
      setError('Failed to save settings')
    }
  }

  if (loading) {
    return <div className="text-text-muted text-sm">Loading...</div>
  }

  const trackedWithInfo = trackedTeams.map((t) => {
    const team = leagueTeams[t.league]?.find((lt) => lt.id === t.teamId)
    return { ...t, info: team }
  })

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-error/10 text-error rounded-lg p-3 text-sm">{error}</div>
      )}

      {/* Tracked teams summary */}
      {trackedTeams.length > 0 && (
        <div>
          <label className="text-xs text-text-muted block mb-2">Tracked Teams</label>
          <div className="flex flex-wrap gap-2">
            {trackedWithInfo.map((t) => (
              <span
                key={`${t.league}-${t.teamId}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sports/10 text-sports text-sm font-medium"
              >
                {t.info && (
                  <img src={t.info.logo} alt="" className="w-4 h-4 object-contain" />
                )}
                {t.info?.name ?? t.teamId}
                <button
                  onClick={() => toggleTeam(t.league, t.teamId)}
                  className="ml-1 text-sports/60 hover:text-sports"
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
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by team name..."
          className="w-full px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
        />
        {searching && <div className="text-xs text-text-muted mt-1">Searching...</div>}
        {searchResults.length > 0 && (
          <div className="mt-2 border border-border rounded-lg overflow-hidden">
            {searchResults.map((team) => (
              <label
                key={`${team.league}-${team.id}`}
                className="flex items-center gap-3 p-2.5 hover:bg-bg-card-hover cursor-pointer border-b border-border last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={isTracked(team.league, team.id)}
                  onChange={() => toggleTeam(team.league, team.id)}
                  className="w-4 h-4 accent-sports"
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
                  {!leagueTeams[league.id] ? (
                    <div className="p-3 text-xs text-text-muted">Loading teams...</div>
                  ) : (
                    leagueTeams[league.id].map((team) => (
                      <label
                        key={team.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-bg-card-hover cursor-pointer border-b border-border last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={isTracked(league.id, team.id)}
                          onChange={() => toggleTeam(league.id, team.id)}
                          className="w-4 h-4 accent-sports"
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

      <div className="flex items-center gap-3">
        <Button onClick={handleSave}>Save</Button>
        {status && <span className="text-sm text-success">{status}</span>}
      </div>
    </div>
  )
}

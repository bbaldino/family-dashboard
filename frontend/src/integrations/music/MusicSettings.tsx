import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/ui/Button'
import { musicIntegration } from './config'

interface Player {
  player_id: string
  display_name: string
  name: string
}

export function MusicSettings() {
  const [serviceUrl, setServiceUrl] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [defaultPlayer, setDefaultPlayer] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [loadingPlayers, setLoadingPlayers] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const config = (await fetch('/api/config').then((r) => r.json())) as Record<string, string>
      setServiceUrl(config['music.service_url'] ?? '')
      setApiToken(config['music.api_token'] ?? '')
      setDefaultPlayer(config['music.default_player'] ?? '')
    } catch {
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const loadPlayers = async () => {
    setLoadingPlayers(true)
    setError(null)
    try {
      const data = await musicIntegration.api.get<Player[]>('/players')
      setPlayers(Array.isArray(data) ? data : [])
    } catch {
      setError('Failed to load players — check URL and token')
    } finally {
      setLoadingPlayers(false)
    }
  }

  const handleSave = async () => {
    try {
      setError(null)
      const saves = [
        ['music.service_url', serviceUrl],
        ['music.api_token', apiToken],
        ['music.default_player', defaultPlayer],
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

  const canLoadPlayers = serviceUrl.trim() !== '' && apiToken.trim() !== ''

  return (
    <div className="space-y-6">
      {error && <div className="bg-error/10 text-error rounded-lg p-3 text-sm">{error}</div>}

      <div>
        <label className="text-xs text-text-muted block mb-1">Music Assistant Url</label>
        <input
          type="text"
          value={serviceUrl}
          onChange={(e) => setServiceUrl(e.target.value)}
          placeholder="e.g. http://192.168.1.42:8095"
          className="w-full px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
        />
      </div>

      <div>
        <label className="text-xs text-text-muted block mb-1">Api Token</label>
        <input
          type="password"
          value={apiToken}
          onChange={(e) => setApiToken(e.target.value)}
          placeholder="Enter API token"
          className="w-full px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
        />
      </div>

      <div>
        <label className="text-xs text-text-muted block mb-1">Default Player</label>
        <div className="flex gap-2 items-start">
          {players.length > 0 ? (
            <select
              value={defaultPlayer}
              onChange={(e) => setDefaultPlayer(e.target.value)}
              className="flex-1 px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
            >
              <option value="">Select a player...</option>
              {players.map((p) => (
                <option key={p.player_id} value={p.player_id}>
                  {p.display_name || p.name || p.player_id}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={defaultPlayer}
              onChange={(e) => setDefaultPlayer(e.target.value)}
              placeholder="Player ID (load players to pick from list)"
              className="flex-1 px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
            />
          )}
          <Button onClick={loadPlayers} disabled={!canLoadPlayers || loadingPlayers}>
            {loadingPlayers ? 'Loading...' : 'Load Players'}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave}>Save</Button>
        {status && <span className="text-sm text-success">{status}</span>}
      </div>
    </div>
  )
}

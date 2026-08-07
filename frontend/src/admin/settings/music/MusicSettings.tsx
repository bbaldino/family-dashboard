import { useState } from 'react'
import { useAllConfig, useSaveConfig } from '@/platform'
import { Button } from '@/ui/Button'
import { usePlayerOptions } from '@/integrations/music'

/**
 * Prefilled once from the shared `/api/config` query, then left alone — same
 * split as `themes/grid/GridSettingsPanel.tsx`: this outer half tracks the
 * live query and re-renders on every poll; the inner form's lazy `useState`
 * initialisers read it once at mount and ignore every later value, so a poll
 * tick can't overwrite an in-progress edit.
 */
export function MusicSettings() {
  const { data, isPending } = useAllConfig()

  if (isPending) {
    return <div className="text-text-muted text-sm">Loading...</div>
  }

  return <MusicSettingsForm config={data} />
}

function MusicSettingsForm({ config }: { config: Record<string, string> | undefined }) {
  const [serviceUrl, setServiceUrl] = useState(() => config?.['music.service_url'] ?? '')
  const [apiToken, setApiToken] = useState(() => config?.['music.api_token'] ?? '')
  const [defaultPlayer, setDefaultPlayer] = useState(() => config?.['music.default_player'] ?? '')
  const [error, setError] = useState<string | null>(config ? null : 'Failed to load settings')
  const [status, setStatus] = useState<string | null>(null)
  // The player fetch's error state only clears on a successful refetch, so a
  // save would otherwise leave the previous failure on screen. The old single
  // `error` string was cleared by `handleSave`; this keeps that. Only
  // `loadPlayers` can make the query fail again, and it lifts this first.
  const [playersErrorDismissed, setPlayersErrorDismissed] = useState(false)
  const saveConfig = useSaveConfig()

  const {
    data: players = [],
    isFetching: loadingPlayers,
    isError: playersFailed,
    refetch: fetchPlayers,
  } = usePlayerOptions()

  const loadPlayers = () => {
    setError(null)
    setPlayersErrorDismissed(false)
    fetchPlayers()
  }

  const handleSave = async () => {
    try {
      setError(null)
      setPlayersErrorDismissed(true)
      // One mutation for all three keys, so the shared config query refetches
      // once for this Save rather than three times.
      await saveConfig.mutateAsync([
        { key: 'music.service_url', value: serviceUrl },
        { key: 'music.api_token', value: apiToken },
        { key: 'music.default_player', value: defaultPlayer },
      ])
      setStatus('Saved!')
      setTimeout(() => setStatus(null), 2000)
    } catch {
      setError('Failed to save settings')
    }
  }

  const canLoadPlayers = serviceUrl.trim() !== '' && apiToken.trim() !== ''

  // One banner for both the config/save errors this screen owns and the
  // player fetch's. Suppressed while a load is in flight, so a retry clears
  // the previous failure the moment it starts rather than when it lands.
  const displayedError =
    error ??
    (playersFailed && !loadingPlayers && !playersErrorDismissed
      ? 'Failed to load players — check URL and token'
      : null)

  return (
    <div className="space-y-6">
      {displayedError && (
        <div className="bg-error/10 text-error rounded-lg p-3 text-sm">{displayedError}</div>
      )}

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
              {/* `value` is the player **id** — that is what
                  `music.default_player` stores and what every playback call
                  resolves. `displayName` is the label only. */}
              {players.map((p) => (
                <option key={p.playerId} value={p.playerId}>
                  {p.displayName}
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

import { useQuery } from '@tanstack/react-query'
import { Volume2 } from 'lucide-react'
import { musicIntegration } from '@/integrations/music/config'
import { useMusic } from '@/integrations/music'
import type { Player } from '@/integrations/music/types'
import { Modal } from '@/ui/Modal'
import { LoadingSpinner } from '@/ui/LoadingSpinner'

interface PlayerPickerProps {
  isOpen: boolean
  onClose: () => void
}

// Raw shape returned by the /players endpoint (snake_case from backend proxy)
interface RawPlayer {
  player_id?: string
  display_name?: string
  name?: string
  state?: string
  available?: boolean
  volume_level?: number | null
}

function normalizePlayer(raw: RawPlayer): Player {
  return {
    playerId: raw.player_id ?? '',
    displayName: raw.display_name ?? raw.name ?? raw.player_id ?? '',
    state: raw.state ?? 'idle',
    available: raw.available ?? true,
    volumeLevel: raw.volume_level ?? null,
  }
}

function StateDot({ state }: { state: string }) {
  const isPlaying = state === 'playing'
  const isIdle = state === 'idle' || state === 'off'

  const colorClass = isPlaying
    ? 'bg-palette-1'
    : isIdle
      ? 'bg-text-secondary'
      : 'bg-yellow-400'

  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${colorClass}`} />
}

function PlayerRow({
  player,
  isActive,
  onTap,
  onVolumeChange,
}: {
  player: Player
  isActive: boolean
  onTap: () => void
  onVolumeChange: (level: number) => void
}) {
  return (
    <div
      className={`flex flex-col gap-2 px-3 py-3 rounded-lg mb-2 border transition-colors ${
        isActive
          ? 'border-palette-1 bg-palette-1/10'
          : 'border-transparent hover:bg-bg-card-hover'
      }`}
    >
      <button
        onClick={onTap}
        className="flex items-center gap-3 w-full text-left"
      >
        <StateDot state={player.state} />
        <span
          className={`flex-1 text-sm font-medium truncate ${
            isActive ? 'text-palette-1' : 'text-text-primary'
          }`}
        >
          {player.displayName}
        </span>
        <span className="text-xs text-text-secondary capitalize">{player.state}</span>
      </button>

      <div className="flex items-center gap-2 pl-5">
        <Volume2 size={13} className="text-text-secondary flex-shrink-0" />
        <input
          type="range"
          min={0}
          max={100}
          value={player.volumeLevel ?? 0}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="flex-1"
        />
        <span className="text-xs text-text-secondary w-7 text-right">
          {player.volumeLevel ?? 0}
        </span>
      </div>
    </div>
  )
}

export function PlayerPicker({ isOpen, onClose }: PlayerPickerProps) {
  const { state, setVolume } = useMusic()
  const activeQueueId = state.activeQueue?.queueId ?? null

  const { data, isLoading } = useQuery({
    queryKey: ['music', 'players'],
    queryFn: () => musicIntegration.api.get<RawPlayer[]>('/players'),
    enabled: isOpen,
    refetchInterval: isOpen ? 10_000 : false,
  })

  const players: Player[] = Array.isArray(data) ? data.map(normalizePlayer) : []

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Players">
      {isLoading ? (
        <div className="flex justify-center py-6">
          <LoadingSpinner />
        </div>
      ) : players.length === 0 ? (
        <div className="text-center py-6 text-text-secondary text-sm">No players available</div>
      ) : (
        <div>
          {players.map((player) => (
            <PlayerRow
              key={player.playerId}
              player={player}
              isActive={player.playerId === activeQueueId}
              onTap={() => {
                console.log('PlayerPicker: selected player', player.playerId)
              }}
              onVolumeChange={(level) => setVolume(player.playerId, level)}
            />
          ))}
        </div>
      )}
    </Modal>
  )
}

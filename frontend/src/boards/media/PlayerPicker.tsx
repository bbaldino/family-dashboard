import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Volume2, Users, Plus, X as XIcon } from 'lucide-react'
import { musicIntegration } from '@/integrations/music/config'
import { useMusic } from '@/integrations/music'
import type { Player } from '@/integrations/music/types'
import { Modal } from '@/ui/Modal'
import { LoadingSpinner } from '@/ui/LoadingSpinner'

interface PlayerPickerProps {
  isOpen: boolean
  onClose: () => void
}

// Raw shape returned by MA via the /players proxy (snake_case fields).
interface RawPlayer {
  player_id?: string
  display_name?: string
  name?: string
  state?: string
  available?: boolean
  volume_level?: number | null
  group_members?: string[] | null
  synced_to?: string | null
  can_group_with?: string[] | null
  group_volume?: number | null
}

function normalizePlayer(raw: RawPlayer): Player {
  return {
    playerId: raw.player_id ?? '',
    displayName: raw.display_name ?? raw.name ?? raw.player_id ?? '',
    state: raw.state ?? 'idle',
    available: raw.available ?? true,
    volumeLevel: raw.volume_level ?? null,
    groupMembers: raw.group_members ?? [],
    syncedTo: raw.synced_to ?? null,
    canGroupWith: raw.can_group_with ?? [],
    groupVolume: raw.group_volume ?? null,
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

function VolumeSlider({
  value,
  onChange,
}: {
  value: number | null
  onChange: (level: number) => void
}) {
  return (
    <div className="flex items-center gap-2 pl-5">
      <Volume2 size={13} className="text-text-secondary flex-shrink-0" />
      <input
        type="range"
        min={0}
        max={100}
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1"
      />
      <span className="text-xs text-text-secondary w-7 text-right">{value ?? 0}</span>
    </div>
  )
}

interface PlayerRowProps {
  player: Player
  leaderId: string | null
  isLeader: boolean
  isFollower: boolean
  canJoin: boolean
  /** When true, the row shares a frame with siblings — drop its own outline
   *  and bg-tint so the group reads as a single panel. */
  framed?: boolean
  onVolumeChange: (level: number) => void
  onAdd: () => void
  onRemove: () => void
  onUngroupAll: () => void
}

function PlayerRow({
  player,
  isLeader,
  isFollower,
  canJoin,
  framed = false,
  onVolumeChange,
  onAdd,
  onRemove,
  onUngroupAll,
}: PlayerRowProps) {
  const inGroup = isLeader || isFollower
  const ownContainer = !framed
  return (
    <div
      className={`flex flex-col gap-2 px-3 py-3 ${
        ownContainer
          ? `rounded-lg mb-2 border transition-colors ${
              inGroup
                ? 'border-palette-1 bg-palette-1/10'
                : 'border-transparent hover:bg-bg-card-hover'
            }`
          : ''
      } ${!player.available || (!inGroup && !canJoin) ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-3 w-full text-left">
        <StateDot state={player.state} />
        <span
          className={`flex-1 text-sm font-medium truncate ${
            inGroup ? 'text-palette-1' : 'text-text-primary'
          }`}
        >
          {player.displayName}
        </span>

        {isLeader && player.groupMembers.length > 0 && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-palette-1 px-1.5 py-0.5 rounded bg-palette-1/20">
            Leader
          </span>
        )}
        {!isLeader && !isFollower && (
          <span className="text-xs text-text-secondary capitalize">
            {canJoin ? player.state : 'incompatible'}
          </span>
        )}

        {/* Right-side action */}
        {isLeader && player.groupMembers.length > 0 ? (
          <button
            onClick={onUngroupAll}
            className="text-xs px-2.5 py-1 rounded border border-error/40 text-error hover:bg-error/10"
          >
            Ungroup all
          </button>
        ) : isFollower ? (
          <button
            onClick={onRemove}
            className="text-xs px-2.5 py-1 rounded border border-error/40 text-error hover:bg-error/10 flex items-center gap-1"
          >
            <XIcon size={11} /> Remove
          </button>
        ) : canJoin && !isLeader ? (
          <button
            onClick={onAdd}
            className="text-xs px-2.5 py-1 rounded border border-palette-1/40 text-palette-1 hover:bg-palette-1/10 flex items-center gap-1"
          >
            <Plus size={11} /> Add
          </button>
        ) : null}
      </div>

      <VolumeSlider value={player.volumeLevel} onChange={onVolumeChange} />
    </div>
  )
}

export function PlayerPicker({ isOpen, onClose }: PlayerPickerProps) {
  const queryClient = useQueryClient()
  const { state, setVolume } = useMusic()
  const activeQueueId = state.activeQueue?.queueId ?? null

  const { data, isLoading } = useQuery({
    queryKey: ['music', 'players'],
    queryFn: () => musicIntegration.api.get<RawPlayer[]>('/players'),
    enabled: isOpen,
    refetchInterval: isOpen ? 5_000 : false,
  })

  const players: Player[] = Array.isArray(data) ? data.map(normalizePlayer) : []
  // The "leader" of the group we're managing on this dashboard is the
  // currently-active queue (which falls back to the configured default
  // player in MusicProvider). Everything else is a candidate follower.
  const leader = players.find((p) => p.playerId === activeQueueId) ?? null
  const leaderId = leader?.playerId ?? null

  const refreshPlayers = () =>
    queryClient.invalidateQueries({ queryKey: ['music', 'players'] })

  const addToGroup = async (playerId: string) => {
    if (!leaderId) return
    await musicIntegration.api.post('/group', {
      player_id: playerId,
      target_player: leaderId,
    })
    refreshPlayers()
  }
  const removeFromGroup = async (playerId: string) => {
    await musicIntegration.api.post('/ungroup', { player_id: playerId })
    refreshPlayers()
  }
  const ungroupAll = async () => {
    if (!leader) return
    // Leader's group_members includes the leader's own id; only ungroup the
    // followers (every other id in the list).
    const followers = leader.groupMembers.filter((id) => id !== leader.playerId)
    await Promise.all(
      followers.map((id) =>
        musicIntegration.api.post('/ungroup', { player_id: id }),
      ),
    )
    refreshPlayers()
  }

  const setGroupVolume = async (level: number) => {
    if (!leaderId) return
    await musicIntegration.api.post('/group-volume', {
      player_id: leaderId,
      level,
    })
    refreshPlayers()
  }

  // MA reports group state via the LEADER's group_members array (which
  // includes the leader's own id). Followers don't reliably populate
  // synced_to, so detect followers via the leader's group_members list.
  const followerIds = new Set(
    (leader?.groupMembers ?? []).filter((id) => id !== leaderId),
  )

  // Sort: leader first, then group followers, then everything else.
  const sorted = [...players].sort((a, b) => {
    const score = (p: Player) => {
      if (p.playerId === leaderId) return 0
      if (followerIds.has(p.playerId)) return 1
      if (leader?.canGroupWith.includes(p.playerId)) return 2
      return 3
    }
    return score(a) - score(b)
  })

  const hasGroup = followerIds.size > 0

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
          {(() => {
            // Pull group members out of the sorted list so we can render them
            // as one unified panel (leader + group-volume header + followers),
            // with everyone else rendered as standalone rows below.
            const groupedRows = sorted.filter(
              (p) => p.playerId === leaderId || followerIds.has(p.playerId),
            )
            const otherRows = sorted.filter(
              (p) => p.playerId !== leaderId && !followerIds.has(p.playerId),
            )

            const rowProps = (player: Player, framed: boolean) => {
              const isLeader = player.playerId === leaderId
              const isFollower = followerIds.has(player.playerId)
              const canJoin =
                !!leader &&
                !isLeader &&
                !isFollower &&
                leader.canGroupWith.includes(player.playerId)
              return {
                player,
                leaderId,
                isLeader,
                isFollower,
                canJoin,
                framed,
                onVolumeChange: (level: number) =>
                  setVolume(player.playerId, level),
                onAdd: () => addToGroup(player.playerId),
                onRemove: () => removeFromGroup(player.playerId),
                onUngroupAll: ungroupAll,
              }
            }

            return (
              <>
                {hasGroup && leader ? (
                  <div className="mb-3 rounded-lg border border-palette-1 bg-palette-1/10 overflow-hidden">
                    <div className="px-3 py-2 border-b border-palette-1/30 flex items-center gap-2">
                      <Users size={14} className="text-palette-1" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-palette-1">
                        Group volume
                      </span>
                      <span className="text-xs text-text-secondary ml-auto">
                        {followerIds.size + 1} speakers
                      </span>
                    </div>
                    <div className="px-3 py-2 border-b border-palette-1/30">
                      <VolumeSlider
                        value={leader.groupVolume}
                        onChange={setGroupVolume}
                      />
                    </div>
                    {groupedRows.map((player, i) => (
                      <div
                        key={player.playerId}
                        className={i > 0 ? 'border-t border-palette-1/20' : ''}
                      >
                        <PlayerRow {...rowProps(player, true)} />
                      </div>
                    ))}
                  </div>
                ) : (
                  // No group yet — render the leader as a regular standalone
                  // row (no special framing).
                  groupedRows.map((player) => (
                    <PlayerRow
                      key={player.playerId}
                      {...rowProps(player, false)}
                    />
                  ))
                )}

                {otherRows.map((player) => (
                  <PlayerRow
                    key={player.playerId}
                    {...rowProps(player, false)}
                  />
                ))}
              </>
            )
          })()}
        </div>
      )}
    </Modal>
  )
}

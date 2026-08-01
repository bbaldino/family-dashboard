import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Volume2, Users, Plus, X as XIcon, Loader2 } from 'lucide-react'
import { musicIntegration, useMusic, usePlayers, normalizePlayer } from '@/data/music'
import type { Player, RawPlayer } from '@/data/music'
import { Modal } from '@/ui/Modal'
import { LoadingSpinner } from '@/ui/LoadingSpinner'

interface PlayerPickerProps {
  isOpen: boolean
  onClose: () => void
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
  /** Group/ungroup operation in flight for this player. */
  pending?: boolean
  /** Group/ungroup operation in flight for *any* follower of the leader —
   *  used to disable the "Ungroup all" button on the leader row. */
  groupBusy?: boolean
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
  pending = false,
  groupBusy = false,
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
            disabled={groupBusy}
            className="text-xs px-2.5 py-1 rounded border border-error/40 text-error hover:bg-error/10 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {groupBusy ? (
              <>
                <Loader2 size={11} className="animate-spin" /> Ungrouping…
              </>
            ) : (
              'Ungroup all'
            )}
          </button>
        ) : isFollower ? (
          <button
            onClick={onRemove}
            disabled={pending}
            className="text-xs px-2.5 py-1 rounded border border-error/40 text-error hover:bg-error/10 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {pending ? (
              <>
                <Loader2 size={11} className="animate-spin" /> Removing…
              </>
            ) : (
              <>
                <XIcon size={11} /> Remove
              </>
            )}
          </button>
        ) : canJoin && !isLeader ? (
          <button
            onClick={onAdd}
            disabled={pending}
            className="text-xs px-2.5 py-1 rounded border border-palette-1/40 text-palette-1 hover:bg-palette-1/10 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {pending ? (
              <>
                <Loader2 size={11} className="animate-spin" /> Adding…
              </>
            ) : (
              <>
                <Plus size={11} /> Add
              </>
            )}
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

  // Player IDs with an in-flight group/ungroup so we can show a spinner and
  // dim/disable the action button until MA confirms the change.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  // True for ~1.5s after a mutation. MA's `players/all` response lags a few
  // hundred ms behind a group/ungroup command landing, so we suppress both
  // the polling refetch and any explicit refresh during that window —
  // otherwise the stale response would clobber our optimistic update.
  const [pollingPaused, setPollingPaused] = useState(false)

  const { data, isLoading } = usePlayers({ isOpen, pollingPaused })

  const players: Player[] = Array.isArray(data) ? data.map(normalizePlayer) : []
  const leader = players.find((p) => p.playerId === activeQueueId) ?? null
  const leaderId = leader?.playerId ?? null

  const refreshPlayers = () =>
    queryClient.invalidateQueries({ queryKey: ['music', 'players'] })

  // Apply an optimistic mutation to the cached /players response so the UI
  // reflects the group change instantly. The real refetch (kicked by
  // refreshPlayers below) reconciles within a second.
  const mutatePlayersCache = (fn: (p: RawPlayer) => RawPlayer) =>
    queryClient.setQueryData<RawPlayer[]>(['music', 'players'], (prev) =>
      prev ? prev.map(fn) : prev,
    )

  // Abort any in-flight /players refetch (e.g. one kicked by the 5s polling
  // interval moments before the user clicked) so it doesn't return with
  // stale pre-mutation data and overwrite our optimistic update.
  const cancelInFlightPlayersFetches = () =>
    queryClient.cancelQueries({ queryKey: ['music', 'players'] })

  const markPending = (ids: string[]) =>
    setPendingIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.add(id)
      return next
    })
  const clearPending = (ids: string[]) =>
    setPendingIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
      return next
    })

  // Lifecycle of a group/ungroup action:
  //   1. Mark pending + pause polling (spinner appears on the ORIGINAL
  //      branch's button — "Adding…" on a +Add row, "Removing…" on a
  //      Remove row).
  //   2. Cancel any in-flight /players fetch.
  //   3. Fire the POST. Wait for it to return (~100ms).
  //   4. Apply the optimistic cache mutation AND clear pending in the same
  //      pass — the row transitions to its new branch with no spinner left
  //      behind on the wrong-labeled button.
  //   5. After MA's propagation window, resume polling + refetch.
  const withOptimistic = async (
    pendingPlayerIds: string[],
    mutator: (p: RawPlayer) => RawPlayer,
    apiCall: () => Promise<unknown>,
  ) => {
    markPending(pendingPlayerIds)
    setPollingPaused(true)
    await cancelInFlightPlayersFetches()
    try {
      await apiCall()
      mutatePlayersCache(mutator)
      clearPending(pendingPlayerIds)
    } catch (err) {
      // POST failed — drop pending so the spinner doesn't get stuck.
      clearPending(pendingPlayerIds)
      throw err
    } finally {
      // Resume polling + reconcile from MA once it's converged.
      setTimeout(() => {
        setPollingPaused(false)
        refreshPlayers()
      }, 1500)
    }
  }

  const addToGroup = (playerId: string) => {
    if (!leaderId) return
    return withOptimistic(
      [playerId],
      (p) => {
        if (p.player_id !== leaderId) return p
        const current = p.group_members ?? []
        const next =
          current.length === 0 ? [leaderId, playerId] : [...current, playerId]
        return { ...p, group_members: next }
      },
      () =>
        musicIntegration.api.post('/group', {
          player_id: playerId,
          target_player: leaderId,
        }),
    )
  }
  const removeFromGroup = (playerId: string) =>
    withOptimistic(
      [playerId],
      (p) => {
        if (p.player_id !== leaderId) return p
        const remaining = (p.group_members ?? []).filter((id) => id !== playerId)
        // If only the leader itself remains, collapse to [] so the UI returns
        // to the "no group" state.
        const cleared = remaining.length <= 1 ? [] : remaining
        return { ...p, group_members: cleared }
      },
      () => musicIntegration.api.post('/ungroup', { player_id: playerId }),
    )
  const ungroupAll = () => {
    if (!leader) return
    const followers = leader.groupMembers.filter((id) => id !== leader.playerId)
    return withOptimistic(
      followers,
      (p) =>
        p.player_id === leader.playerId ? { ...p, group_members: [] } : p,
      () =>
        Promise.all(
          followers.map((id) =>
            musicIntegration.api.post('/ungroup', { player_id: id }),
          ),
        ),
    )
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

            // The leader's "Ungroup all" button stays busy while any of its
            // followers is mid-ungroup.
            const anyFollowerPending = [...followerIds].some((id) =>
              pendingIds.has(id),
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
                pending: pendingIds.has(player.playerId),
                groupBusy: isLeader ? anyFollowerPending : false,
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

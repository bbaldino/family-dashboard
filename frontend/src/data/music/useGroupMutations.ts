import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { musicIntegration } from './config'
import type { RawPlayer } from './usePlayers'
import type { Player } from './types'

/**
 * Group/ungroup/group-volume mutations against `/api/music`, lifted out of
 * grid's `PlayerPicker` so broadsheet's room pills can drive the same Sonos
 * grouping without either theme reaching into the other (the eslint
 * `boundaries/dependencies` rule forbids a theme-to-theme import — see
 * `eslint.config.js`).
 *
 * This is a move, not a redesign: every piece of `PlayerPicker`'s optimistic
 * handling — the pending-id bookkeeping, the polling pause, the
 * cancel-then-mutate-then-resume sequencing around each POST — is unchanged,
 * just parameterized so a caller supplies which player is the "leader" for
 * a given call instead of the hook assuming one. `PlayerPicker` derives its
 * leader from the active queue; broadsheet's room pills derive theirs from
 * the configured anchor (`useRoomPills`) — same mutations, two different
 * notions of "who's the leader" supplied by the caller.
 */
export function useGroupMutations() {
  const queryClient = useQueryClient()

  // Player IDs with an in-flight group/ungroup so a caller can show a
  // spinner and dim/disable the action button until MA confirms the change.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  // True for ~1.5s after a mutation. MA's `players/all` response lags a few
  // hundred ms behind a group/ungroup command landing, so callers should
  // suppress both the polling refetch and any explicit refresh during that
  // window — otherwise the stale response would clobber the optimistic
  // update. Feed this straight into `usePlayers`'s `pollingPaused` option.
  const [pollingPaused, setPollingPaused] = useState(false)

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
  // interval moments before the user tapped) so it doesn't return with
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

  const addToGroup = (playerId: string, leaderId: string | null) => {
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

  const removeFromGroup = (playerId: string, leaderId: string | null) =>
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

  const ungroupAll = (leader: Player | null) => {
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

  const setGroupVolume = async (leaderId: string | null, level: number) => {
    if (!leaderId) return
    await musicIntegration.api.post('/group-volume', {
      player_id: leaderId,
      level,
    })
    refreshPlayers()
  }

  return {
    pendingIds,
    pollingPaused,
    addToGroup,
    removeFromGroup,
    ungroupAll,
    setGroupVolume,
  }
}

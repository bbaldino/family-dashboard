import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { musicIntegration } from './config'
import type { RawPlayer } from './usePlayers'
import type { Player } from './types'

const PLAYERS_QUERY_KEY = ['music', 'players']

// How long to keep confirming after a group/ungroup/group-volume POST
// resolves, and how often. Measured repeatedly against the real service, and
// the headline is the *variance*: the POST itself returned anywhere from
// 0.03s to 2.2s, and Music Assistant's `players/all` caught up somewhere
// between ~1s and ~12s — on the same pair of speakers, minutes apart.
//
// The ceiling is therefore set well past the slowest convergence seen rather
// than snugly around the typical one. Giving up early is not free: the
// reconciling refetch then writes MA's stale pre-mutation state over a
// correct optimistic one, which flips the pill back — and because a pill is a
// toggle, the next tap reads that wrong state and sends the wrong command.
// That exact sequence was observed live, sending two /group commands where
// the second should have been /ungroup. A generous bound just means holding a
// correct optimistic value a little longer; a tight one means acting on a
// wrong one.
export const CONFIRM_POLL_INTERVAL_MS = 500
export const CONFIRM_POLL_TIMEOUT_MS = 15_000

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Group/ungroup/group-volume mutations against `/api/music`, lifted out of
 * grid's `PlayerPicker` so broadsheet's room pills can drive the same Sonos
 * grouping without either theme reaching into the other (the eslint
 * `boundaries/dependencies` rule forbids a theme-to-theme import — see
 * `eslint.config.js`).
 *
 * The optimistic handling here is stricter than what was first lifted out of
 * `PlayerPicker` — that version patched the cache *after* the POST resolved
 * (not actually optimistic: every tap looked dead for the first ~0.3–0.5s)
 * and resumed polling on a fixed 1500ms guess. Measured against the real
 * service, that guess was wrong: MA doesn't converge until ~2s, so the
 * resume-timer's refetch landed inside MA's stale window and clobbered the
 * pill right back to its pre-tap state — worse, a *second* overlapping
 * mutation got its own polling pause cancelled early by the *first*
 * mutation's independent timer, since both shared one boolean. Three fixes,
 * all in this file so both themes benefit:
 *
 *  1. Apply the optimistic patch immediately, before the POST — see
 *     `runMutation` below — and roll it back (not just leave it in place)
 *     if the POST rejects.
 *  2. Replace the fixed delay with bounded confirmation polling
 *     (`waitForConvergence`): after the POST resolves, poll the real
 *     `/players` endpoint until it actually agrees with what was
 *     optimistically written, rather than assuming a delay was long enough.
 *  3. Refcount in-flight mutations (`inFlightCountRef`) instead of one
 *     shared boolean with one independent resume-timer per call, so
 *     `usePlayers`'s polling only resumes once every overlapping mutation
 *     has actually settled.
 *
 * Every mutator here only ever touches its own leader row's `group_members`
 * or `group_volume` field, and both apply and rollback read the cache's
 * *current* value at call time (via `mutatePlayersCache`/`applyToLeader`)
 * rather than restoring a snapshot captured back at the start of the call.
 * That's what lets two overlapping mutations against the same leader (e.g.
 * joining the Patio, then the Deck, before the first has confirmed) each
 * compose and roll back correctly without one clobbering the other — a
 * snapshot-based rollback would restore the array as it was *before* the
 * first mutation started, silently erasing whatever the second one had
 * since added.
 *
 * This is otherwise the same lift described before: parameterized so a
 * caller supplies which player is the "leader" for a given call instead of
 * the hook assuming one. `PlayerPicker` derives its leader from the active
 * queue; broadsheet's room pills derive theirs from the configured anchor
 * (`useRoomPills`) — same mutations, two different notions of "who's the
 * leader" supplied by the caller.
 */
export function useGroupMutations() {
  const queryClient = useQueryClient()

  // Player IDs with an in-flight group/ungroup so a caller can show a
  // spinner and dim/disable the action button until MA confirms the change.
  // Stays populated for the whole confirm-polling window now, not just the
  // POST round trip — see the header comment on why that's now a real
  // (if short) window instead of ~0.3s.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  // Refcounts overlapping mutations so `usePlayers`'s polling only resumes
  // once every one of them has actually settled — not the moment any single
  // one's own resume-timer fires (the bug: a second tap's pause getting
  // cancelled early by the first tap's independent timer). The count itself
  // lives in a ref, not state, because it's read/written imperatively from
  // async mutation lifecycles; `pollingPaused` is the bit of state derived
  // from it that actually needs to trigger a re-render.
  const inFlightCountRef = useRef(0)
  const [pollingPaused, setPollingPaused] = useState(false)

  const beginMutation = () => {
    inFlightCountRef.current += 1
    setPollingPaused(true)
  }
  const endMutation = () => {
    inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1)
    if (inFlightCountRef.current === 0) {
      // The last of any overlapping mutations to finish — safe to resume
      // normal polling and reconcile once via a real refetch.
      setPollingPaused(false)
      queryClient.invalidateQueries({ queryKey: PLAYERS_QUERY_KEY })
    }
  }

  // Apply a mutation to the cached /players response so the UI reflects a
  // change instantly — called both for the optimistic apply (before the
  // POST) and for a rollback (after a rejected POST), always against
  // whatever the cache currently holds, never a stale captured copy.
  const mutatePlayersCache = (fn: (p: RawPlayer) => RawPlayer) =>
    queryClient.setQueryData<RawPlayer[]>(PLAYERS_QUERY_KEY, (prev) => (prev ? prev.map(fn) : prev))

  const applyToLeader = (leaderId: string, transform: (p: RawPlayer) => RawPlayer) =>
    mutatePlayersCache((p) => (p.player_id === leaderId ? transform(p) : p))

  // Membership reads from two places — the leader's `group_members` and the
  // follower's own `synced_to` (see `useRoomPills`'s `isJoinedToAnchor`, which
  // ORs them because MA doesn't populate `synced_to` reliably). An optimistic
  // write therefore has to move BOTH, or the half it skips keeps reporting the
  // pre-tap answer: patching only the leader made a *removal* still read as
  // joined, because the follower's stale `synced_to` kept the OR true until
  // the real refetch landed seconds later.
  const setSyncedTo = (playerId: string, leaderId: string | null) =>
    mutatePlayersCache((p) => (p.player_id === playerId ? { ...p, synced_to: leaderId } : p))

  // Abort any in-flight /players refetch (e.g. one kicked by the 5s polling
  // interval moments before the user tapped) so it doesn't land after our
  // optimistic apply and overwrite it with stale pre-mutation data.
  const cancelInFlightPlayersFetches = () =>
    queryClient.cancelQueries({ queryKey: PLAYERS_QUERY_KEY })

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

  // Poll the real /players endpoint (not the react-query cache — this is a
  // truth check, not a write) until `isConfirmed` reports the mutation has
  // actually landed, or until CONFIRM_POLL_TIMEOUT_MS runs out. Same
  // real-service caveat as the POST itself: this only ever fires once a
  // mutation's own POST has resolved, i.e. only when a tap for real runs
  // against the real service — never during this file's own tests or a
  // `?scenario=` browser check where no mutation is actually invoked.
  const waitForConvergence = async (isConfirmed: (players: RawPlayer[]) => boolean) => {
    const deadline = Date.now() + CONFIRM_POLL_TIMEOUT_MS
    while (Date.now() < deadline) {
      await delay(CONFIRM_POLL_INTERVAL_MS)
      try {
        const players = await musicIntegration.api.get<RawPlayer[]>('/players')
        if (isConfirmed(players)) return
      } catch {
        // Transient fetch error — this is a confirmation check, not the
        // mutation itself, so keep polling until the deadline rather than
        // treating it as failure.
      }
    }
    // Gave up: MA hasn't visibly converged within the bound. Don't hold the
    // optimistic write hostage waiting forever — `endMutation`'s refetch
    // (once every overlapping mutation finishes) will show whatever's real.
  }

  interface MutationSpec {
    /** Player ids to mark pending for the duration of this call. */
    pendingIds: string[]
    /** Optimistic cache write, applied immediately, before the POST fires. */
    apply: () => void
    /** Inverse of `apply`, applied to the *current* cache if the POST rejects. */
    rollback: () => void
    apiCall: () => Promise<unknown>
    /** Does a real /players response show this mutation has landed? Omit to
     *  skip confirmation polling entirely — appropriate for a value that is
     *  superseded faster than it can be confirmed (see `setGroupVolume`). */
    isConfirmed?: (players: RawPlayer[]) => boolean
  }

  const runMutation = async ({
    pendingIds: ids,
    apply,
    rollback,
    apiCall,
    isConfirmed,
  }: MutationSpec) => {
    markPending(ids)
    beginMutation()
    // Apply synchronously, before anything else — including the
    // cancel-in-flight-fetches call just below, which itself returns a
    // promise. Awaiting that first would push the optimistic write behind a
    // microtask, which is small but real: the whole point is that a tap
    // reflects instantly, not "instantly, modulo whatever else happens to
    // be queued first."
    apply()
    await cancelInFlightPlayersFetches()

    try {
      await apiCall()
      // Clear the visual pending cue as soon as the command is accepted, not
      // when MA finally converges. Convergence time is highly variable —
      // measured between ~2s and ~12s on the same pair of speakers — and the
      // optimistic write already shows the user the outcome. Holding a pill
      // dimmed for ten seconds after a change that has visibly taken effect
      // reads as "still working" when nothing is left to wait for.
      // `pollingPaused` and the reconciling refetch stay governed by the
      // convergence check below.
      clearPending(ids)
      if (isConfirmed) await waitForConvergence(isConfirmed)
    } catch (err) {
      rollback()
      throw err
    } finally {
      clearPending(ids)
      endMutation()
    }
  }

  const addToGroup = (playerId: string, leaderId: string | null) => {
    if (!leaderId) return
    return runMutation({
      pendingIds: [playerId],
      apply: () => {
        applyToLeader(leaderId, (p) => {
          const members = new Set(p.group_members?.length ? p.group_members : [leaderId])
          members.add(playerId)
          return { ...p, group_members: [...members] }
        })
        setSyncedTo(playerId, leaderId)
      },
      rollback: () => {
        applyToLeader(leaderId, (p) => {
          const members = new Set(p.group_members ?? [])
          members.delete(playerId)
          // Collapse to [] once only the leader itself remains, matching the
          // "no group" resting state everywhere else in this file.
          return { ...p, group_members: members.size <= 1 ? [] : [...members] }
        })
        setSyncedTo(playerId, null)
      },
      apiCall: () =>
        musicIntegration.api.post('/group', { player_id: playerId, target_player: leaderId }),
      isConfirmed: (players) => {
        const leader = players.find((p) => p.player_id === leaderId)
        return !!leader && (leader.group_members ?? []).includes(playerId)
      },
    })
  }

  const removeFromGroup = (playerId: string, leaderId: string | null) =>
    runMutation({
      pendingIds: [playerId],
      apply: () => {
        mutatePlayersCache((p) => {
          if (p.player_id !== leaderId) return p
          const remaining = (p.group_members ?? []).filter((id) => id !== playerId)
          const cleared = remaining.length <= 1 ? [] : remaining
          return { ...p, group_members: cleared }
        })
        setSyncedTo(playerId, null)
      },
      rollback: () => {
        mutatePlayersCache((p) => {
          if (p.player_id !== leaderId) return p
          const members = new Set(p.group_members ?? [])
          if (leaderId) members.add(leaderId)
          members.add(playerId)
          return { ...p, group_members: [...members] }
        })
        setSyncedTo(playerId, leaderId)
      },
      apiCall: () => musicIntegration.api.post('/ungroup', { player_id: playerId }),
      isConfirmed: (players) => {
        if (!leaderId) return true
        const leader = players.find((p) => p.player_id === leaderId)
        return !leader || !(leader.group_members ?? []).includes(playerId)
      },
    })

  const ungroupAll = (leader: Player | null) => {
    if (!leader) return
    const followers = leader.groupMembers.filter((id) => id !== leader.playerId)
    const previousMembers = leader.groupMembers
    return runMutation({
      pendingIds: followers,
      apply: () => {
        applyToLeader(leader.playerId, (p) => ({ ...p, group_members: [] }))
        for (const id of followers) setSyncedTo(id, null)
      },
      rollback: () => {
        applyToLeader(leader.playerId, (p) => ({ ...p, group_members: previousMembers }))
        for (const id of followers) setSyncedTo(id, leader.playerId)
      },
      apiCall: () =>
        Promise.all(
          followers.map((id) => musicIntegration.api.post('/ungroup', { player_id: id })),
        ),
      isConfirmed: (players) => {
        const current = players.find((p) => p.player_id === leader.playerId)
        return !current || (current.group_members ?? []).length <= 1
      },
    })
  }

  const setGroupVolume = (leaderId: string | null, level: number) => {
    if (!leaderId) return
    const previousVolume =
      queryClient
        .getQueryData<RawPlayer[]>(PLAYERS_QUERY_KEY)
        ?.find((p) => p.player_id === leaderId)?.group_volume ?? null
    return runMutation({
      // No visual pending state for a volume drag — unchanged from before
      // this file's rollback/refcount treatment was extended to cover it.
      pendingIds: [],
      apply: () => applyToLeader(leaderId, (p) => ({ ...p, group_volume: level })),
      rollback: () => applyToLeader(leaderId, (p) => ({ ...p, group_volume: previousVolume })),
      apiCall: () => musicIntegration.api.post('/group-volume', { player_id: leaderId, level }),
      // Deliberately no confirmation polling. The group-volume control is an
      // `<input type="range">` whose `onChange` fires on every drag step, so
      // one drag emits dozens of these. Waiting for `group_volume === level`
      // would have each intermediate value — already superseded by the next
      // drag step — poll `/players` every 500ms for the full 6s bound before
      // giving up: hundreds of requests per drag, with polling paused
      // throughout. A volume is a continuous value that the next event
      // replaces, not a discrete state transition worth confirming; the
      // optimistic apply and the rollback-on-failure above are the parts
      // that matter here.
    })
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

import { createContext } from 'react'
import type { MusicState } from './types'

export type EnqueueMode = 'play' | 'next' | 'add'

export interface PlayOptions {
  radio?: boolean
  /** How MA should slot this into the queue. Default is "play" which replaces
   *  the queue and starts immediately. "next" inserts after the current track,
   *  "add" appends to the end of the queue. */
  enqueueMode?: EnqueueMode
  /** Display metadata so the backend's explicit-play log can render this in
   *  Recently Played without re-querying MA for the URI's details. */
  mediaType?: string
  name?: string
  artist?: string
  artistUri?: string
  album?: string
  albumUri?: string
  imageUrl?: string
}

/** A transport action that failed, for a theme to surface. Actions used to
 *  reject into nothing — no caller awaited them, so a failure became an
 *  unhandled rejection and the UI was identical to a tap that was ignored.
 *  That cost real debugging time: a track whose radio station Music Assistant
 *  couldn't build returned 500 on every tap and looked simply dead. */
export interface MusicActionError {
  /** Written for the wall, not the console: "Couldn't play “Go”." */
  message: string
  /** Distinguishes two consecutive identical failures, so a re-tap that fails
   *  the same way still reads as a fresh event rather than a stuck notice. */
  at: number
}

/** A play action in flight, so a theme can acknowledge a tap while Music
 *  Assistant cues it. The `play_media` round-trip — a radio attempt, its
 *  fallback when the station can't be built, then a log lookup — can take a
 *  noticeable beat, and until it returns nothing signals the tap landed. Set
 *  the instant `play` is called and cleared when the request settles: the
 *  same missing-feedback gap `MusicActionError` closes, but for the slow path
 *  rather than the failed one. */
export interface PlayPending {
  /** The item being cued, written for the wall: `“Go”`, or `that` when a
   *  caller played a bare URI with no name. */
  label: string
  /** Distinguishes consecutive cues so a re-tap restarts the notice rather
   *  than reusing one already on screen. */
  at: number
}

export interface MusicContextValue {
  state: MusicState
  /** The panel's own room as a display label — the anchor first, then any
   *  rooms grouped into it: `Kitchen`, `Kitchen, Deck and Patio`. Separate
   *  from `state.activeQueue.displayName`, which names whichever player
   *  *owns* that queue and under grouping is a different room. `null` when
   *  no anchor is configured or the players list hasn't arrived, in which
   *  case a surface should fall back to the queue owner's name. */
  anchorRoomLabel: string | null
  isPlaying: boolean
  isConnected: boolean
  /** The most recent failed action, or null. Cleared by `dismissError`. */
  actionError: MusicActionError | null
  dismissError: () => void
  /** A play cued but not yet confirmed by the backend, or null — set the
   *  instant `play` is called, cleared when it settles. Mutually exclusive
   *  with `actionError`: starting a play clears any stale failure. */
  playPending: PlayPending | null
  play: (uri: string, options?: PlayOptions) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  stop: () => Promise<void>
  next: () => Promise<void>
  previous: () => Promise<void>
  setVolume: (playerId: string, level: number) => Promise<void>
}

const emptyState: MusicState = { queues: [], activeQueue: null }

const noOp = async () => {}

export const defaultContextValue: MusicContextValue = {
  state: emptyState,
  anchorRoomLabel: null,
  isPlaying: false,
  isConnected: false,
  actionError: null,
  dismissError: () => {},
  playPending: null,
  play: noOp,
  pause: noOp,
  resume: noOp,
  stop: noOp,
  next: noOp,
  previous: noOp,
  setVolume: noOp,
}

export const MusicContext = createContext<MusicContextValue | null>(null)

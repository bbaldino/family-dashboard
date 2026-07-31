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

export interface MusicContextValue {
  state: MusicState
  isPlaying: boolean
  isConnected: boolean
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
  isPlaying: false,
  isConnected: false,
  play: noOp,
  pause: noOp,
  resume: noOp,
  stop: noOp,
  next: noOp,
  previous: noOp,
  setVolume: noOp,
}

export const MusicContext = createContext<MusicContextValue | null>(null)

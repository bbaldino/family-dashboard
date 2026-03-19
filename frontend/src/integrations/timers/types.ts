export interface Timer {
  id: string
  name: string
  durationMs: number
  startedAt: string
  endsAt: string
  status: 'running' | 'paused' | 'fired' | 'cancelled'
  remainingMs: number
  pausedRemainingMs?: number
  createdAt: string
}

export interface TimerEvent {
  type: 'snapshot' | 'created' | 'fired' | 'cancelled' | 'paused' | 'resumed'
  timer?: Timer
  timers?: Timer[]
}

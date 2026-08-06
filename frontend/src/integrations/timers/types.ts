export interface Timer {
  id: string
  name: string
  durationMs: number
  startedAt: string
  endsAt: string
  status: 'running' | 'paused' | 'fired' | 'cancelled' | 'dismissed'
  remainingMs: number
  pausedRemainingMs?: number
  createdAt: string
}

export interface TimerEvent {
  type: 'snapshot' | 'created' | 'fired' | 'cancelled' | 'paused' | 'resumed' | 'dismissed'
  timer?: Timer
  timers?: Timer[]
}

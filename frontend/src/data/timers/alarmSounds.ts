function tone(
  ctx: AudioContext,
  freq: number,
  start: number,
  duration: number,
  volume = 0.3,
  type: OscillatorType = 'sine',
) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.frequency.value = freq
  osc.type = type
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
  osc.start(start)
  osc.stop(start + duration)
}

export interface AlarmSound {
  id: string
  name: string
  description: string
  /** Play once (for preview). Returns an AudioContext that can be closed to stop. */
  play: () => AudioContext
  /** Schedule one instance of this sound on a shared context at a given time offset */
  schedule: (ctx: AudioContext, baseTime: number) => void
  /** How long one play-through takes (seconds) */
  duration: number
}

function makeAlarm(
  id: string,
  name: string,
  description: string,
  duration: number,
  schedule: (ctx: AudioContext, t: number) => void,
): AlarmSound {
  return {
    id,
    name,
    description,
    duration,
    schedule,
    play: () => {
      const ctx = new AudioContext()
      schedule(ctx, ctx.currentTime)
      return ctx
    },
  }
}

export const ALARM_SOUNDS: AlarmSound[] = [
  makeAlarm('gentle-chime', 'Gentle Chime', 'Two-note ascending chime, soft and musical', 2.4,
    (ctx, t) => {
      for (let i = 0; i < 3; i++) {
        const offset = i * 0.8
        tone(ctx, 523, t + offset, 0.5, 0.2)
        tone(ctx, 659, t + offset + 0.2, 0.6, 0.2)
      }
    },
  ),
  makeAlarm('kitchen-bell', 'Kitchen Bell', 'Quick triple ding at a bright pitch', 2.5,
    (ctx, t) => {
      for (let i = 0; i < 3; i++) {
        tone(ctx, 1047, t + i * 0.35, 0.2, 0.25, 'triangle')
      }
      for (let i = 0; i < 3; i++) {
        tone(ctx, 1047, t + 1.4 + i * 0.35, 0.2, 0.25, 'triangle')
      }
    },
  ),
  makeAlarm('soft-doorbell', 'Soft Doorbell', 'Warm two-tone doorbell chime', 2.4,
    (ctx, t) => {
      for (let i = 0; i < 2; i++) {
        const offset = i * 1.2
        tone(ctx, 659, t + offset, 0.8, 0.2, 'sine')
        tone(ctx, 523, t + offset + 0.3, 1.0, 0.15, 'sine')
      }
    },
  ),
  makeAlarm('xylophone-cascade', 'Xylophone Cascade', 'Rising 4-note musical phrase', 2.4,
    (ctx, t) => {
      const notes = [523, 659, 784, 1047]
      for (let r = 0; r < 2; r++) {
        for (let i = 0; i < notes.length; i++) {
          tone(ctx, notes[i], t + r * 1.2 + i * 0.15, 0.4, 0.2, 'triangle')
        }
      }
    },
  ),
  makeAlarm('meditation-bowl', 'Meditation Bowl', 'Single resonant tone that fades slowly', 6.5,
    (ctx, t) => {
      tone(ctx, 262, t, 3.0, 0.15, 'sine')
      tone(ctx, 524, t, 2.5, 0.08, 'sine')
      tone(ctx, 786, t + 0.01, 2.0, 0.04, 'sine')
      tone(ctx, 262, t + 3.5, 3.0, 0.15, 'sine')
      tone(ctx, 524, t + 3.5, 2.5, 0.08, 'sine')
      tone(ctx, 786, t + 3.51, 2.0, 0.04, 'sine')
    },
  ),
  makeAlarm('marimba-pattern', 'Marimba Pattern', 'Warm wooden tone pattern, like a softer iPhone alarm', 3.6,
    (ctx, t) => {
      const pattern: [number, number][] = [
        [523, 0], [659, 0.2], [523, 0.4], [784, 0.6], [659, 1.0], [523, 1.2],
      ]
      for (let r = 0; r < 2; r++) {
        for (const [freq, offset] of pattern) {
          tone(ctx, freq, t + r * 1.8 + offset, 0.3, 0.2, 'triangle')
        }
      }
    },
  ),
]

export const DEFAULT_ALARM_ID = 'gentle-chime'

export function getAlarmById(id: string): AlarmSound {
  return ALARM_SOUNDS.find((s) => s.id === id) ?? ALARM_SOUNDS[0]
}

const REPEAT_COUNT = 20 // pre-schedule up to 20 repeats (~2 minutes for most sounds)
const GAP_BETWEEN_REPEATS = 2 // seconds of silence between each repeat

/**
 * Start a repeating alarm. Pre-schedules all repeats on a single AudioContext
 * so timing is precise. Returns a stop function that closes the context.
 */
export function startRepeatingAlarm(soundId: string): () => void {
  const alarm = getAlarmById(soundId)
  try {
    const ctx = new AudioContext()
    const t = ctx.currentTime
    const interval = alarm.duration + GAP_BETWEEN_REPEATS

    for (let i = 0; i < REPEAT_COUNT; i++) {
      alarm.schedule(ctx, t + i * interval)
    }

    // Auto-close after all repeats finish
    const totalDuration = REPEAT_COUNT * interval
    const autoCloseTimer = setTimeout(() => {
      ctx.close().catch(() => {})
    }, totalDuration * 1000 + 1000) // +1s buffer

    return () => {
      clearTimeout(autoCloseTimer)
      ctx.close().catch(() => {})
    }
  } catch {
    return () => {}
  }
}

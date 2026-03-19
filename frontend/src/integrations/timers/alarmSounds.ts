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
  play: () => void
}

export const ALARM_SOUNDS: AlarmSound[] = [
  {
    id: 'gentle-chime',
    name: 'Gentle Chime',
    description: 'Two-note ascending chime, soft and musical',
    play: () => {
      const ctx = new AudioContext()
      const t = ctx.currentTime
      for (let i = 0; i < 3; i++) {
        const offset = i * 0.8
        tone(ctx, 523, t + offset, 0.5, 0.2)
        tone(ctx, 659, t + offset + 0.2, 0.6, 0.2)
      }
    },
  },
  {
    id: 'kitchen-bell',
    name: 'Kitchen Bell',
    description: 'Quick triple ding at a bright pitch',
    play: () => {
      const ctx = new AudioContext()
      const t = ctx.currentTime
      for (let i = 0; i < 3; i++) {
        tone(ctx, 1047, t + i * 0.25, 0.2, 0.25, 'triangle')
      }
      for (let i = 0; i < 3; i++) {
        tone(ctx, 1047, t + 1.0 + i * 0.25, 0.2, 0.25, 'triangle')
      }
    },
  },
  {
    id: 'soft-doorbell',
    name: 'Soft Doorbell',
    description: 'Warm two-tone doorbell chime',
    play: () => {
      const ctx = new AudioContext()
      const t = ctx.currentTime
      for (let i = 0; i < 2; i++) {
        const offset = i * 1.2
        tone(ctx, 659, t + offset, 0.8, 0.2, 'sine')
        tone(ctx, 523, t + offset + 0.3, 1.0, 0.15, 'sine')
      }
    },
  },
  {
    id: 'xylophone-cascade',
    name: 'Xylophone Cascade',
    description: 'Rising 4-note musical phrase',
    play: () => {
      const ctx = new AudioContext()
      const t = ctx.currentTime
      const notes = [523, 659, 784, 1047]
      for (let r = 0; r < 2; r++) {
        for (let i = 0; i < notes.length; i++) {
          tone(ctx, notes[i], t + r * 1.2 + i * 0.15, 0.4, 0.2, 'triangle')
        }
      }
    },
  },
  {
    id: 'meditation-bowl',
    name: 'Meditation Bowl',
    description: 'Single resonant tone that fades slowly',
    play: () => {
      const ctx = new AudioContext()
      const t = ctx.currentTime
      tone(ctx, 262, t, 3.0, 0.15, 'sine')
      tone(ctx, 524, t, 2.5, 0.08, 'sine')
      tone(ctx, 786, t + 0.01, 2.0, 0.04, 'sine')
      tone(ctx, 262, t + 3.5, 3.0, 0.15, 'sine')
      tone(ctx, 524, t + 3.5, 2.5, 0.08, 'sine')
      tone(ctx, 786, t + 3.51, 2.0, 0.04, 'sine')
    },
  },
  {
    id: 'marimba-pattern',
    name: 'Marimba Pattern',
    description: 'Warm wooden tone pattern, like a softer iPhone alarm',
    play: () => {
      const ctx = new AudioContext()
      const t = ctx.currentTime
      const pattern: [number, number][] = [
        [523, 0], [659, 0.2], [523, 0.4], [784, 0.6], [659, 1.0], [523, 1.2],
      ]
      for (let r = 0; r < 2; r++) {
        for (const [freq, offset] of pattern) {
          tone(ctx, freq, t + r * 1.8 + offset, 0.3, 0.2, 'triangle')
        }
      }
    },
  },
]

export const DEFAULT_ALARM_ID = 'gentle-chime'

export function getAlarmById(id: string): AlarmSound {
  return ALARM_SOUNDS.find((s) => s.id === id) ?? ALARM_SOUNDS[0]
}

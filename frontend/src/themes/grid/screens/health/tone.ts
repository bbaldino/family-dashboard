import type { Status } from './types'

export interface StatusTone {
  dot: string
  text: string
  bg: string
  border: string
  pillBg: string
  pillText: string
  label: string
}

export function statusTone(status: Status): StatusTone {
  switch (status) {
    case 'ok':
      return {
        dot: 'bg-success',
        text: 'text-success',
        bg: 'bg-success',
        border: 'border-success',
        pillBg: 'bg-success/15',
        pillText: 'text-success',
        label: 'OK',
      }
    case 'degraded':
      return {
        dot: 'bg-warning',
        text: 'text-warning',
        bg: 'bg-warning',
        border: 'border-warning',
        pillBg: 'bg-warning/15',
        pillText: 'text-warning',
        label: 'Degraded',
      }
    case 'critical':
      return {
        dot: 'bg-error',
        text: 'text-error',
        bg: 'bg-error',
        border: 'border-error',
        pillBg: 'bg-error/15',
        pillText: 'text-error',
        label: 'Critical',
      }
    default:
      return {
        dot: 'bg-text-muted',
        text: 'text-text-muted',
        bg: 'bg-text-muted',
        border: 'border-text-muted',
        pillBg: 'bg-text-muted/15',
        pillText: 'text-text-muted',
        label: status === null ? 'Never checked' : 'Unknown',
      }
  }
}

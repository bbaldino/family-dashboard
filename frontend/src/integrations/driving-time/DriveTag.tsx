import type { DriveUrgency } from './types'

const urgencyStyles: Record<DriveUrgency, string> = {
  ok: 'bg-[color-mix(in_srgb,var(--color-role-success)_10%,transparent)] text-success',
  soon: 'bg-[color-mix(in_srgb,var(--color-role-warning)_10%,transparent)] text-role-warning',
  urgent: 'bg-[color-mix(in_srgb,var(--color-role-error)_10%,transparent)] text-error',
}

interface DriveTagProps {
  displayText: string
  urgency: DriveUrgency
}

export function DriveTag({ displayText, urgency }: DriveTagProps) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md ${urgencyStyles[urgency]}`}>
      <span>🚗</span>
      {displayText}
    </span>
  )
}

import { z } from 'zod'
import type { FieldMeta } from '@/platform'

/** Split from `settings.tsx` and `GridSettingsPanel.tsx` so both can import it
 *  without a cycle: `settings.tsx` builds `gridSettings` from it, and
 *  `GridSettingsPanel` reads its field labels from it, rather than each
 *  hardcoding its own copy of the same strings. */
export const gridSettingsSchema = z.object({
  columns: z.coerce.number().int().min(1).max(24).default(8),
  rows: z.coerce.number().int().min(1).max(24).default(6),
  hidden: z.string().default(''),
})

export const gridSettingsFields: Record<keyof z.infer<typeof gridSettingsSchema>, FieldMeta> = {
  columns: { label: 'Grid columns' },
  rows: { label: 'Grid rows' },
  hidden: { label: 'Visible widgets' },
}

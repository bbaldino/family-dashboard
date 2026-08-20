import type { LunchMenuData, LunchMenuDay } from '@/integrations/nutrislice'

export interface LunchPreview {
  /** The menu to show, or null when there's no school on the chosen day. */
  day: LunchMenuDay | null
  /** How to label it in the heading. */
  label: 'today' | 'tomorrow'
}

/**
 * Which day's lunch the Home cafeteria panel previews, and how it's labelled.
 *
 * Before noon it's today's — the meal actually coming up. From noon on, today's
 * lunch is behind us, so it flips to tomorrow's and the heading says so, keeping
 * the panel useful for the rest of the day; it flips back to "today" once the
 * clock crosses midnight into the next day.
 *
 * The two weekend wrinkles fall straight out of the data (`today`/`tomorrow`
 * are `null` when there's no school): on a Sunday there is no "today", so even
 * the morning already looks ahead to Monday; and after noon on a Friday
 * "tomorrow" is Saturday, so there is simply nothing to preview until Sunday
 * rolls forward to Monday.
 */
export function pickLunchPreview(lunch: LunchMenuData, now: Date): LunchPreview {
  const afternoon = now.getHours() >= 12
  if (!afternoon) {
    if (lunch.today) return { day: lunch.today, label: 'today' }
    // No school today (a Sunday) — look ahead rather than sit blank all morning.
    if (lunch.tomorrow) return { day: lunch.tomorrow, label: 'tomorrow' }
    return { day: null, label: 'today' }
  }
  // Afternoon: today's lunch is done, so preview tomorrow — which is `null`, and
  // shows as "no school tomorrow", on a Friday.
  return { day: lunch.tomorrow, label: 'tomorrow' }
}

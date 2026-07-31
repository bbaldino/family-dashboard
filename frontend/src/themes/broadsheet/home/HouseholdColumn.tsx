import type { ReactNode } from 'react'
import { useCountdowns } from '@/data/countdowns'
import { useOnThisDay } from '@/data/on-this-day'
import { useChores } from '@/data/chores'
import { useLunchMenu } from '@/data/nutrislice'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'
import { Hairline } from '@/themes/broadsheet/ui/Hairline'

const valueStyle = {
  fontFamily: 'var(--font-display)',
  fontStyle: 'italic' as const,
  fontSize: 14,
  color: 'var(--ink)',
  lineHeight: 1.3,
}

const dimStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  color: 'var(--ink-muted)',
  letterSpacing: '0.04em',
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-2">
      <Kicker>{label}</Kicker>
      <Hairline className="mb-1" />
      {children}
    </div>
  )
}

/**
 * The third column of the Home screen's body: the household rundown —
 * lunch, chores, what's coming up, and a bit of trivia — stacked top to
 * bottom in that order. Every source can be empty on a cold cache; each
 * section is guarded independently and simply drops out (no empty slot held
 * open), so the column reflows around whatever data has actually arrived.
 *
 * Was `GlanceStrip`: a horizontal band across the foot of the page. It's a
 * vertical column now (see `Home`'s doc comment for why), so that name
 * would be stale — renamed to describe what it actually shows.
 */
export function HouseholdColumn() {
  const { data: lunch } = useLunchMenu()
  const { data: chores } = useChores()
  const { data: countdowns } = useCountdowns()
  const { data: onThisDay } = useOnThisDay()

  const lunchToday = lunch?.today
  const hasLunch = !!lunchToday && (lunchToday.entries.length > 0 || lunchToday.extras.length > 0)
  const hasChores = !!chores && chores.total_count > 0
  const nextCountdowns = (countdowns ?? []).slice(0, 3)
  const onThisDayEvent = onThisDay?.events?.[0]

  const sections: { key: string; node: ReactNode }[] = []

  if (hasLunch && lunchToday) {
    const items = lunchToday.entries.length > 0
      ? lunchToday.entries.map((entry) => entry.name)
      : lunchToday.extras
    sections.push({
      key: 'lunch',
      node: (
        <Section label="Lunch">
          <span style={valueStyle}>{items.join(', ')}</span>
        </Section>
      ),
    })
  }

  if (hasChores && chores) {
    sections.push({
      key: 'chores',
      node: (
        <Section label="Chores today">
          <span style={valueStyle}>
            {chores.completed_count}/{chores.total_count} done
          </span>
        </Section>
      ),
    })
  }

  if (nextCountdowns.length > 0) {
    sections.push({
      key: 'countdown',
      node: (
        <Section label="Coming up">
          {nextCountdowns.map((item) => (
            <div key={item.id} className="flex items-baseline gap-2">
              <span style={valueStyle}>{item.name}</span>
              <span style={{ ...dimStyle, color: 'var(--rust)' }}>{item.daysUntil}d</span>
            </div>
          ))}
        </Section>
      ),
    })
  }

  if (onThisDayEvent) {
    sections.push({
      key: 'on-this-day',
      node: (
        <Section label="On this day">
          <div className="flex items-baseline gap-2">
            {onThisDayEvent.year !== null && (
              <span style={{ ...valueStyle, fontSize: 18, color: 'var(--rust)' }}>{onThisDayEvent.year}</span>
            )}
            <span style={valueStyle}>{onThisDayEvent.text}</span>
          </div>
        </Section>
      ),
    })
  }

  if (sections.length === 0) return null

  return (
    <div className="flex flex-col">
      {sections.map(({ key, node }) => (
        <div key={key} style={{ minWidth: 0 }}>
          {node}
        </div>
      ))}
    </div>
  )
}
